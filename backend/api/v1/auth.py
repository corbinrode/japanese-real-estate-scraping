from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from bson import ObjectId
from core.models import (
    UserCreate, LoginResponse, User, UserInDB, 
    SubscriptionPlan, SubscriptionPlanInfo, UserUpdate, UserPasswordUpdate
)
from core.auth import (
    get_password_hash, authenticate_user, create_access_token,
    get_current_active_user, get_user_by_email, verify_password
)
from core.config import settings
from core.database import user_db

router = APIRouter()

# Single subscription plan configuration
SUBSCRIPTION_PLAN = SubscriptionPlanInfo(
    name=SubscriptionPlan.PREMIUM,
    price=20.00,
    features=[
        "Access to all real estate listings", 
    ],
    duration_days=30
)

@router.post("/check-email")
async def check_email(email_data: dict):
    """Check if email is already registered"""
    email = email_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    existing_user = await get_user_by_email(email)
    return {
        "exists": existing_user is not None,
        "message": "Email already registered" if existing_user else "Email available"
    }

@router.post("/register", response_model=dict)
async def register_user(user_data: UserCreate):
    """Register a new user"""
    # Check if user already exists
    existing_user = await get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user document
    user_doc = {
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "hashed_password": hashed_password,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert into user database
    users_collection = user_db["users"]
    result = users_collection.insert_one(user_doc)
    
    if result.inserted_id:
        return {
            "message": "Account created successfully! You can now log in.",
            "user_id": str(result.inserted_id)
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.post("/login", response_model=LoginResponse)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login user and return JWT token"""
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user's subscription info (don't block login if expired/cancelled)
    subscriptions_collection = user_db["subscriptions"]
    subscription_doc = subscriptions_collection.find_one({
        "user_id": user.id
    }, sort=[("created_at", -1)])  # Get most recent subscription
    
    subscription = None
    if subscription_doc:
        subscription_doc["id"] = str(subscription_doc["_id"])
        del subscription_doc["_id"]
        subscription = subscription_doc
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=User(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        ),
        subscription=subscription
    )

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

@router.get("/subscription-plan")
async def get_subscription_plan():
    """Get the subscription plan"""
    return {"plan": SUBSCRIPTION_PLAN}

@router.post("/logout")
async def logout_user(current_user: User = Depends(get_current_active_user)):
    """Logout user (client should remove token)"""
    return {"message": "Successfully logged out"}

@router.put("/update-name", response_model=dict)
async def update_user_name(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Update user's name"""
    try:
        users_collection = user_db["users"]
        
        # Update user name
        result = users_collection.update_one(
            {"_id": ObjectId(current_user.id)},
            {
                "$set": {
                    "name": user_update.name,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update name"
            )
        
        return {
            "message": "Name updated successfully",
            "name": user_update.name
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update name: {str(e)}"
        )

@router.put("/update-password", response_model=dict)
async def update_user_password(
    password_update: UserPasswordUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Update user's password"""
    try:
        users_collection = user_db["users"]
        
        # Get current user with password hash
        user_doc = users_collection.find_one({"_id": ObjectId(current_user.id)})
        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify current password
        if not verify_password(password_update.current_password, user_doc["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Hash new password
        new_hashed_password = get_password_hash(password_update.new_password)
        
        # Update password
        result = users_collection.update_one(
            {"_id": ObjectId(current_user.id)},
            {
                "$set": {
                    "hashed_password": new_hashed_password,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update password"
            )
        
        return {
            "message": "Password updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update password: {str(e)}"
        ) 