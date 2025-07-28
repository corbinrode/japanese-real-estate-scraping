from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.v1 import listings
from core.config import settings


app = FastAPI()

# CORS settings
environment = settings.ENVIRONMENT
allowOrigins = ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowOrigins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# Mount static files for images
app.mount("/images", StaticFiles(directory="images"), name="images")

# Include routers with version prefix
app.include_router(listings.router, prefix="/v1/listings", tags=["listings"])