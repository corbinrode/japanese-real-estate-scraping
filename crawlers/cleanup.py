import os
import requests
import pymongo
import urllib.parse
from config import settings
from helpers import setup_logger
from concurrent.futures import ThreadPoolExecutor, as_completed

# set up logger
logger = setup_logger('cleanup', 'cleanup')

# DB config
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient(f"mongodb://{user}:{password}@{settings.DB_HOST}:{settings.DB_PORT}")
db = client.crawler_data

# Settings
REQUEST_TIMEOUT = 10  # seconds
BASE_IMAGE_PATH = "/home/admin/japanese-real-estate-scraping/crawlers"
MAX_WORKERS = 20  # Tune this based on your system and network capacity

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def process_document(collection_name, doc):
    collection = db[collection_name]
    link = doc.get("link")
    images = doc.get("images", [])

    if not link:
        return

    try:
        response = requests.get(link, timeout=REQUEST_TIMEOUT, headers=headers)
        if response.status_code in [404, 410]:
            logger.info(f"Deleting document with link {link} (status {response.status_code})")

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

            collection.delete_one({"_id": doc["_id"]})
    except requests.RequestException as e:
        logger.error(f"Skipping {link} due to request error: {e}")

# Process collections in parallel
for collection_name in db.list_collection_names():
    collection = db[collection_name]
    logger.info(f"Checking collection: {collection_name}")

    docs = list(collection.find({}, {"link": 1, "images": 1}))
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(process_document, collection_name, doc) for doc in docs]
        for future in as_completed(futures):
            pass  # We don't need the result, just want to wait for completion
