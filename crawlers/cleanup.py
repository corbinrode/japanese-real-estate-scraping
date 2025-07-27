import os
import requests
import pymongo
import urllib.parse
from config import settings
from helpers import setup_logger

# set up logger
logger = setup_logger('cleanup', 'cleanup')

# DB config
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data

# --- Request timeout settings ---
REQUEST_TIMEOUT = 5  # seconds
BASE_IMAGE_PATH = "/home/admin/japanese-real-estate-scraping/crawlers"

# --- Process each collection ---
for collection_name in db.list_collection_names():
    collection = db[collection_name]
    logger.info(f"Checking collection: {collection_name}")
    
    for doc in collection.find({}, {"link": 1, "images": 1}):  # Retrieve link and images
        link = doc.get("link")
        images = doc.get("images", [])

        if not link:
            continue

        try:
            response = requests.get(link, timeout=REQUEST_TIMEOUT)
            if response.status_code in [404, 410]:
                logger.info(f"Deleting document with link {link} (status {response.status_code})")

                # --- Delete each image file ---
                for relative_path in images:
                    abs_path = os.path.join(BASE_IMAGE_PATH, relative_path)
                    try:
                        if os.path.exists(abs_path):
                            os.remove(abs_path)
                            logger.info(f"  Deleted image: {abs_path}")
                        else:
                            logger.info(f"  Image not found: {abs_path}")
                    except Exception as e:
                        logger.error(f"  Error deleting {abs_path}: {e}")

                # --- Delete the document from MongoDB ---
                collection.delete_one({"_id": doc["_id"]})
        except requests.RequestException as e:
            logger.error(f"Skipping {link} due to request error: {e}")
