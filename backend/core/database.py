from core.config import settings
from pymongo import MongoClient

# Create MongoDB client
client = MongoClient(settings.database_url)

# Separate databases for different data types
listings_db = client[settings.CRAWLER_DB]  # For property listings
user_db = client[settings.USER_DB]         # For users and subscriptions
favorites_db = client[settings.FAVORITES_DB]

# Legacy reference for existing listings code
db = listings_db