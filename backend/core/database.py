from core.config import settings
from pymongo import MongoClient

# Create a MongoDB client
client = MongoClient(settings.database_url)
db = client[settings.CRAWLER_DB]