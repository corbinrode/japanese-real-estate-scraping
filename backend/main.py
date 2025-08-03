from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.v1 import listings, auth, payments, favorites
from core.config import settings


app = FastAPI(title="Akiya Helper Homes API", version="1.0.0")

# CORS settings
environment = settings.ENVIRONMENT

if environment == "development":
    allowOrigins = ["*"]
else:
    allowOrigins = [
        "https://akiyahelper.homes",
        "https://www.akiyahelper.homes"
    ]


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
app.include_router(auth.router, prefix="/v1/auth", tags=["authentication"])
app.include_router(payments.router, prefix="/v1/payments", tags=["payments"])
app.include_router(favorites.router, prefix="/v1/favorites", tags=["favorites"])

@app.get("/")
async def root():
    return {"message": "Akiya Helper Homes API", "version": "1.0.0"}