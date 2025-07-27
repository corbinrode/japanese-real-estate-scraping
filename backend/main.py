from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1 import listings
from core.config import settings


app = FastAPI()

# CORS settings
environment = settings.ENVIRONMENT
allowOrigins = ["*"]

if environment == "DEV":
    allowOrigins = ["http://localhost:3000"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowOrigins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# Include routers with version prefix
app.include_router(listings.router, prefix="/v1/listings", tags=["listings"])