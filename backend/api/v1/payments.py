from datetime import datetime, timedelta
from typing import Optional
import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Request
from bson import ObjectId
from core.models import (
    SubscriptionCreate, PaymentResponse, Subscription, 
    SubscriptionStatus, User, UserCreate
)
from core.auth import get_current_active_user, get_password_hash, get_user_by_email
from core.config import settings
from core.database import user_db

router = APIRouter()

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Single subscription plan price
PLAN_PRICE = 20.00

@router.get("/config")
async def get_payment_config():
    """Get payment configuration for the frontend"""
    return {
        "stripe": {
            "publishable_key": settings.STRIPE_PUBLISHABLE_KEY
        }
    }

# Updated model to include user data
class SubscriptionCreateWithUser(SubscriptionCreate):
    # User registration data
    name: str
    email: str
    password: str

@router.post("/create-subscription", response_model=PaymentResponse)
async def create_subscription(
    subscription_data: SubscriptionCreateWithUser
):
    """Create a new subscription along with user account"""
    
    # Check if user already exists
    existing_user = await get_user_by_email(subscription_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    try:
        if subscription_data.payment_provider.value == "stripe":
            return await process_stripe_subscription_with_user(subscription_data, PLAN_PRICE)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Stripe payment provider is supported"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment processing failed: {str(e)}"
        )

async def process_stripe_subscription_with_user(
    subscription_data: SubscriptionCreateWithUser, 
    plan_price: float
) -> PaymentResponse:
    """Process Stripe subscription and create user account"""
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
        
        # Create or get existing product
        try:
            # Try to find existing product
            products = stripe.Product.list(name="Akiya Helper Listings Premium Access", limit=1)
            
            if products.data:
                product_id = products.data[0].id
            else:
                # Create new product
                product = stripe.Product.create(name="Akiya Helper Listings Premium Access")
                product_id = product.id
        except Exception:
            # Create product inline if lookup fails
            product = stripe.Product.create(name="Akiya Helper Listings Premium Access")
            product_id = product.id

        # Create subscription with automatic renewal
        subscription_params = {
            "customer": customer.id,
            "payment_behavior": "default_incomplete",
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
            "role": "user",
            "hashed_password": hashed_password,
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

@router.post("/renew-subscription", response_model=PaymentResponse)
async def renew_subscription(
    subscription_data: SubscriptionCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Renew an expired or cancelled subscription"""
    
    # Check if user has an existing subscription that needs renewal
    subscriptions_collection = user_db["subscriptions"]
    existing_subscription = subscriptions_collection.find_one({
        "user_id": current_user.id
    }, sort=[("created_at", -1)])  # Get most recent subscription
    
    if existing_subscription and existing_subscription.get("status") == "active":
        # Check if it's actually expired
        ends_at = existing_subscription.get("ends_at")
        if isinstance(ends_at, str):
            ends_at = datetime.fromisoformat(ends_at.replace('Z', '+00:00'))
        
        if ends_at > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an active subscription"
            )
    
    try:
        if subscription_data.payment_provider.value == "stripe":
            return await process_stripe_renewal(subscription_data, current_user, PLAN_PRICE)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Stripe payment provider is supported"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment processing failed: {str(e)}"
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
        
        # Create or get existing product
        try:
            # Try to find existing product
            products = stripe.Product.list(name="Akiya Helper Listings Premium Access", limit=1)
            
            if products.data:
                product_id = products.data[0].id
            else:
                # Create new product
                product = stripe.Product.create(name="Akiya Helper Listings Premium Access")
                product_id = product.id
        except Exception:
            # Create product inline if lookup fails
            product = stripe.Product.create(name="Akiya Helper Listings Premium Access")
            product_id = product.id

        # Create new subscription with product ID
        subscription_params = {
            "customer": customer.id,
            "payment_behavior": "default_incomplete",
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

@router.get("/subscription")
async def get_user_subscription(current_user: User = Depends(get_current_active_user)):
    """Get current user's subscription"""
    subscriptions_collection = user_db["subscriptions"]
    # Get the most recent subscription (active, cancelled, expired, etc.)
    subscription_doc = subscriptions_collection.find_one({
        "user_id": current_user.id
    }, sort=[("created_at", -1)])  # Get most recent subscription
    
    if not subscription_doc:
        return {"subscription": None, "message": "No subscription found"}
    
    subscription_doc["id"] = str(subscription_doc["_id"])
    del subscription_doc["_id"]
    
    return {"subscription": subscription_doc}

@router.post("/cancel-subscription")
async def cancel_subscription(current_user: User = Depends(get_current_active_user)):
    """Cancel user's subscription"""
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "user_id": current_user.id,
        "status": "active"
    })
    
    if not subscription_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found"
        )
    
    try:
        message = "Subscription cancelled successfully"
        
        # Cancel with Stripe at period end (user keeps access until billing cycle ends)
        if subscription_doc.get("stripe_subscription_id"):
            try:
                # First, get the current subscription status from Stripe
                stripe_subscription = stripe.Subscription.retrieve(subscription_doc["stripe_subscription_id"])
                
                if stripe_subscription.status == "active":
                    # Only modify if subscription is still active
                    stripe.Subscription.modify(
                        subscription_doc["stripe_subscription_id"],
                        cancel_at_period_end=True
                    )
                    message = "Subscription will be cancelled at the end of your current billing period. You'll retain access until then."
                elif stripe_subscription.status in ["canceled", "cancelled"]:
                    # Already cancelled in Stripe
                    message = "Subscription is already cancelled"
                else:
                    # Handle other statuses (incomplete, past_due, etc.)
                    message = f"Subscription status is {stripe_subscription.status}. Marked as cancelled in our system."
                    
            except stripe.error.StripeError as stripe_error:
                # If Stripe call fails, still update our database
                print(f"Stripe error during cancellation: {stripe_error}")
                message = "Subscription cancelled in our system. Please contact support if you continue to be charged."
        
        # Update subscription status to indicate it's cancelled
        subscriptions_collection.update_one(
            {"_id": subscription_doc["_id"]},
            {"$set": {
                "status": "cancelled",
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {"message": message}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel subscription: {str(e)}"
        ) 

@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event['type'] == 'invoice.payment_succeeded':
        await handle_subscription_payment_succeeded(event['data']['object'])
    elif event['type'] == 'invoice.payment_failed':
        await handle_subscription_payment_failed(event['data']['object'])
    elif event['type'] == 'customer.subscription.deleted':
        await handle_subscription_cancelled(event['data']['object'])
    elif event['type'] == 'customer.subscription.updated':
        await handle_subscription_updated(event['data']['object'])
    
    return {"status": "success"}

async def handle_subscription_payment_succeeded(invoice):
    """Handle successful subscription payment (renewal)"""
    subscription_id = invoice.get('subscription')
    if not subscription_id:
        return
    
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "stripe_subscription_id": subscription_id
    })
    
    if subscription_doc:
        # Extend subscription by 30 days
        current_end = subscription_doc.get('ends_at', datetime.utcnow())
        if isinstance(current_end, str):
            current_end = datetime.fromisoformat(current_end.replace('Z', '+00:00'))
        
        new_end_date = max(datetime.utcnow(), current_end) + timedelta(days=30)
        
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
    
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "stripe_subscription_id": subscription_id
    })
    
    if subscription_doc:
        # Mark subscription as expired after payment failure
        subscriptions_collection.update_one(
            {"_id": subscription_doc["_id"]},
            {"$set": {
                "status": "expired",
                "updated_at": datetime.utcnow()
            }}
        )

async def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    subscription_id = subscription['id']
    
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "stripe_subscription_id": subscription_id
    })
    
    if subscription_doc:
        subscriptions_collection.update_one(
            {"_id": subscription_doc["_id"]},
            {"$set": {
                "status": "expired" if datetime.utcnow() > subscription_doc.get("ends_at", datetime.utcnow()) else "cancelled",
                "updated_at": datetime.utcnow()
            }}
        )

async def handle_subscription_updated(subscription):
    """Handle subscription updates"""
    subscription_id = subscription['id']
    
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "stripe_subscription_id": subscription_id
    })
    
    if subscription_doc:
        # Update subscription status based on Stripe status
        stripe_status = subscription.get('status')
        our_status = "active"
        
        if stripe_status in ['canceled', 'unpaid']:
            our_status = "cancelled"
        elif stripe_status in ['past_due', 'incomplete_expired']:
            our_status = "expired"
        
        subscriptions_collection.update_one(
            {"_id": subscription_doc["_id"]},
            {"$set": {
                "status": our_status,
                "updated_at": datetime.utcnow()
            }}
        ) 