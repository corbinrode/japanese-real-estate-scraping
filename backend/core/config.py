# backend/app/core/config.py
from pydantic_settings import BaseSettings
import urllib.parse


class Settings(BaseSettings):
    # Database Configuration (original format with username/password)
    DB_HOST: str
    DB_PORT: str
    DB_USER: str
    DB_PASSWORD: str
    CRAWLER_DB: str  # For listings data
    USER_DB: str     # For user and subscription data
    ENVIRONMENT: str

    @property
    def database_url(self):
        user = urllib.parse.quote_plus(self.DB_USER)
        password = urllib.parse.quote_plus(self.DB_PASSWORD)

        # Base connection string
        base_url = "mongodb://%s:%s@%s:%s" % (user, password, self.DB_HOST, self.DB_PORT)
        return base_url
    
    # JWT settings
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Payment API keys
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRODUCT_ID: str = ""
    
    class Config:
        env_file = ".env"

settings = Settings()