from datetime import datetime, timedelta
from typing import Optional
import stripe
from fastapi import HTTPException, status
from bson import ObjectId

from .models import (
    SubscriptionCreateWithUser, SubscriptionCreate, PaymentResponse, 
    Subscription, SubscriptionStatus, User, UserCreate
)
from .auth import get_password_hash, get_user_by_email
from .config import settings
from .database import user_db

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Single subscription plan price
PLAN_PRICE = 20.00


async def process_stripe_subscription_with_user(
    subscription_data: SubscriptionCreateWithUser, 
    plan_price: float
) -> PaymentResponse:
    """Process Stripe subscription with new user creation"""
    try:
        # Create Stripe customer
        customer = stripe.Customer.create(
            email=subscription_data.email,
            name=subscription_data.name
        )
        
        # Attach payment method to customer
        payment_method = stripe.PaymentMethod.attach(
            subscription_data.payment_token,
            customer=customer.id
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            customer.id,
            invoice_settings={"default_payment_method": payment_method.id}
        )
        
        # Get existing product by ID from config
        try:
            # Use product ID from config
            product_id = settings.STRIPE_PRODUCT_ID
            if not product_id:
                raise Exception("STRIPE_PRODUCT_ID not configured")
            
            # Verify the product exists in Stripe
            product = stripe.Product.retrieve(product_id)
            if not product:
                raise Exception(f"Product with ID {product_id} not found in Stripe")
                
        except Exception as e:
            raise Exception(f"Failed to get Stripe product: {str(e)}")

        # Create subscription with product ID
        subscription_params = {
            "customer": customer.id,
            "payment_behavior": "error_if_incomplete",
            "payment_settings": {
                "save_default_payment_method": "on_subscription"
            },
            "expand": ["latest_invoice.payment_intent"],
            "items": [{
                "price_data": {
                    "currency": "usd",
                    "product": product_id,
                    "unit_amount": int(plan_price * 100),
                    "recurring": {"interval": "month"}
                }
            }]
        }
        
        stripe_subscription = stripe.Subscription.create(**subscription_params)
        
        # Create user account
        hashed_password = get_password_hash(subscription_data.password)
        user_doc = {
            "email": subscription_data.email,
            "name": subscription_data.name,
            "hashed_password": hashed_password,
            "role": "user",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        users_collection = user_db["users"]
        user_result = users_collection.insert_one(user_doc)
        user_id = str(user_result.inserted_id)
        
        # Create subscription record
        subscription_doc = {
            "user_id": user_id,
            "plan": "premium",
            "status": "active",
            "payment_provider": "stripe",
            "stripe_subscription_id": stripe_subscription.id,
            "starts_at": datetime.utcnow(),
            "ends_at": datetime.utcnow() + timedelta(days=30),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        subscriptions_collection = user_db["subscriptions"]
        subscription_result = subscriptions_collection.insert_one(subscription_doc)
        
        return PaymentResponse(
            success=True,
            subscription_id=str(subscription_result.inserted_id),
            message="Account created and subscription activated successfully!"
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


async def process_stripe_renewal(
    subscription_data: SubscriptionCreate, 
    user: User,
    plan_price: float
) -> PaymentResponse:
    """Process Stripe subscription renewal"""
    try:
        # Get or create Stripe customer
        customers = stripe.Customer.list(email=user.email, limit=1)
        
        if customers.data:
            customer = customers.data[0]
        else:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.name
            )
        
        # Attach payment method to customer
        payment_method = stripe.PaymentMethod.attach(
            subscription_data.payment_token,
            customer=customer.id
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            customer.id,
            invoice_settings={"default_payment_method": payment_method.id}
        )
        
        # Get existing product by ID from config
        try:
            # Use product ID from config
            product_id = settings.STRIPE_PRODUCT_ID
            if not product_id:
                raise Exception("STRIPE_PRODUCT_ID not configured")
            
            # Verify the product exists in Stripe
            product = stripe.Product.retrieve(product_id)
            if not product:
                raise Exception(f"Product with ID {product_id} not found in Stripe")
                
        except Exception as e:
            raise Exception(f"Failed to get Stripe product: {str(e)}")

        # Create new subscription with product ID
        subscription_params = {
            "customer": customer.id,
            "payment_behavior": "error_if_incomplete",
            "payment_settings": {
                "save_default_payment_method": "on_subscription"
            },
            "expand": ["latest_invoice.payment_intent"],
            "items": [{
                "price_data": {
                    "currency": "usd",
                    "product": product_id,
                    "unit_amount": int(plan_price * 100),
                    "recurring": {"interval": "month"}
                }
            }]
        }
        
        stripe_subscription = stripe.Subscription.create(**subscription_params)
        
        # Create new subscription record
        subscription_doc = {
            "user_id": user.id,
            "plan": "premium",
            "status": "active",
            "payment_provider": "stripe",
            "stripe_subscription_id": stripe_subscription.id,
            "starts_at": datetime.utcnow(),
            "ends_at": datetime.utcnow() + timedelta(days=30),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        subscriptions_collection = user_db["subscriptions"]
        subscription_result = subscriptions_collection.insert_one(subscription_doc)
        
        return PaymentResponse(
            success=True,
            subscription_id=str(subscription_result.inserted_id),
            message="Subscription renewed successfully!"
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


async def reactivate_cancelled_subscription(subscription_doc: dict, user: User) -> PaymentResponse:
    """Reactivate a cancelled subscription that's still within the active period"""
    try:
        # Update payment method if provided
        stripe_subscription_id = subscription_doc.get("stripe_subscription_id")
        if stripe_subscription_id:
            # Remove cancel_at_period_end flag to reactivate the subscription
            stripe.Subscription.modify(
                stripe_subscription_id,
                cancel_at_period_end=False
            )
        
        # Update subscription status back to active
        subscriptions_collection = user_db["subscriptions"]
        subscriptions_collection.update_one(
            {"_id": subscription_doc["_id"]},
            {"$set": {
                "status": "active",
                "updated_at": datetime.utcnow()
            }}
        )
        
        return PaymentResponse(
            success=True,
            subscription_id=str(subscription_doc["_id"]),
            message="Subscription reactivated successfully! Your access will continue beyond the current period."
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


async def process_stripe_subscription_for_user(
    subscription_data: SubscriptionCreate, 
    user: User,
    plan_price: float
) -> PaymentResponse:
    """Process Stripe subscription for existing authenticated user"""
    try:
        # Get or create Stripe customer
        customers = stripe.Customer.list(email=user.email, limit=1)
        
        if customers.data:
            customer = customers.data[0]
        else:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.name
            )
        
        # Attach payment method to customer
        payment_method = stripe.PaymentMethod.attach(
            subscription_data.payment_token,
            customer=customer.id
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            customer.id,
            invoice_settings={"default_payment_method": payment_method.id}
        )
        
        # Get existing product by ID from config
        try:
            # Use product ID from config
            product_id = settings.STRIPE_PRODUCT_ID
            if not product_id:
                raise Exception("STRIPE_PRODUCT_ID not configured")
            
            # Verify the product exists in Stripe
            product = stripe.Product.retrieve(product_id)
            if not product:
                raise Exception(f"Product with ID {product_id} not found in Stripe")
                
        except Exception as e:
            raise Exception(f"Failed to get Stripe product: {str(e)}")

        # Create subscription with product ID
        subscription_params = {
            "customer": customer.id,
            "payment_behavior": "error_if_incomplete",
            "payment_settings": {
                "save_default_payment_method": "on_subscription"
            },
            "expand": ["latest_invoice.payment_intent"],
            "items": [{
                "price_data": {
                    "currency": "usd",
                    "product": product_id,
                    "unit_amount": int(plan_price * 100),
                    "recurring": {"interval": "month"}
                }
            }]
        }
        
        stripe_subscription = stripe.Subscription.create(**subscription_params)
        
        # Create subscription record
        subscription_doc = {
            "user_id": user.id,
            "plan": "premium",
            "status": "active",
            "payment_provider": "stripe",
            "stripe_subscription_id": stripe_subscription.id,
            "starts_at": datetime.utcnow(),
            "ends_at": datetime.utcnow() + timedelta(days=30),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        subscriptions_collection = user_db["subscriptions"]
        subscription_result = subscriptions_collection.insert_one(subscription_doc)
        
        return PaymentResponse(
            success=True,
            subscription_id=str(subscription_result.inserted_id),
            message="Subscription activated successfully!"
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


# Webhook handlers
async def handle_subscription_payment_succeeded(invoice):
    """Handle successful subscription payment"""
    subscription_id = invoice.get('subscription')
    if not subscription_id:
        return
    
    # Update subscription status in database
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "stripe_subscription_id": subscription_id
    })
    
    if subscription_doc:
        # Extend subscription period
        new_end_date = datetime.utcnow() + timedelta(days=30)
        subscriptions_collection.update_one(
            {"_id": subscription_doc["_id"]},
            {"$set": {
                "status": "active",
                "ends_at": new_end_date,
                "updated_at": datetime.utcnow()
            }}
        )


async def handle_subscription_payment_failed(invoice):
    """Handle failed subscription payment"""
    subscription_id = invoice.get('subscription')
    if not subscription_id:
        return
    
    # Update subscription status in database
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "stripe_subscription_id": subscription_id
    })
    
    if subscription_doc:
        subscriptions_collection.update_one(
            {"_id": subscription_doc["_id"]},
            {"$set": {
                "status": "inactive",
                "ends_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )


async def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    subscription_id = subscription.get('id')
    if not subscription_id:
        return
    
    period_end = datetime.fromtimestamp(subscription['canceled_at'])
    
    # Update subscription status in database
    subscriptions_collection = user_db["subscriptions"]
    subscriptions_collection.update_one(
        {"stripe_subscription_id": subscription_id},
        {"$set": {
            "status": "cancelled",
            "ends_at": period_end,
            "updated_at": datetime.utcnow()
        }}
    )


async def handle_subscription_updated(subscription):
    """Handle subscription updates"""
    subscription_id = subscription.get('id')
    if not subscription_id:
        return
    
    # Update subscription details in database
    subscriptions_collection = user_db["subscriptions"]
    
    # Convert Stripe timestamp to datetime
    period_end = datetime.fromtimestamp(subscription.get('cancel_at'))
    if period_end:
        update_data = {
            "status": "cancelled",
            "ends_at": period_end,
            "updated_at": datetime.utcnow()
        }
    
    
    # Update status based on Stripe status
    if period_end:
        subscriptions_collection.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": update_data}
        ) 