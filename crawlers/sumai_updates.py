import time
import random
import requests
import pymongo
import urllib.parse
import os
import bson
from bs4 import BeautifulSoup
from uuid import uuid4
from helpers import translate_text, get_table_field_english, save_image, setup_logger, convert_to_usd
from config import settings
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Set up logger
logger = setup_logger('sumai_updates', 'sumai_updates')


BASE_URL = "https://akiya.sumai.biz/category/%E5%A3%B2%E8%B2%B7%E4%BE%A1%E6%A0%BC%E5%B8%AF/page/{}"
MAX_RETRIES = 5
INITIAL_BACKOFF = 30  # in seconds
MAX_WORKERS = 10  # Reduce workers for image scraping to be respectful

# Thread-local storage for database connections
thread_local = threading.local()

def get_db_connection():
    """Get thread-local database connection"""
    if not hasattr(thread_local, 'client'):
        user = urllib.parse.quote_plus(settings.DB_USER)
        password = urllib.parse.quote_plus(settings.DB_PASSWORD)
        thread_local.client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
        thread_local.db = thread_local.client.crawler_data
        thread_local.collection = thread_local.db.sumai_collection
    return thread_local.collection

# DB config
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data
collection = db.sumai_collection

# --- REQUEST FUNCTION WITH JITTER AND BACKOFF ---
def fetch_with_backoff(url):
    backoff = INITIAL_BACKOFF
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.text
            else:
                logger.warning(f"Non-200 status: {response.status_code}")
        except requests.RequestException as e:
            logger.error(f"Request failed: {e}")

        # Exponential backoff with jitter
        jitter = random.uniform(0, backoff)
        logger.info(f"Retrying in {jitter:.2f} seconds...")
        time.sleep(jitter)
        backoff *= 2

    logger.error("Max retries exceeded.")
    return None


# --- FUNCTION TO SCRAPE ADDITIONAL IMAGES FOR EXISTING DOCUMENT ---
def scrape_additional_images(document):
    """Scrape additional images for a document that only has 1 image"""
    link = document.get("link")
    property_id = document.get("_id")
    existing_images = document.get("images", [])
    
    if not link:
        logger.warning(f"No link found for document {property_id}")
        return False
    
    logger.info(f"Scraping additional images for: {link}")
    
    # Add a small delay to be respectful to the server
    time.sleep(random.uniform(1, 3))
    
    # Get thread-local database connection
    thread_collection = get_db_connection()
    
    # Fetch the listing page
    html = fetch_with_backoff(link)
    if not html:
        logger.error(f"Problem fetching listing link: {link}")
        return False

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    listing_content = soup.find('header', class_='entry-header')
    if not listing_content:
        logger.error(f"Could not find listing content for: {link}")
        return False

    # Get the listing details
    main_content = listing_content.find("div", class_="entry-content")
    if not main_content:
        logger.error(f"Could not find main content for: {link}")
        return False
    
    # Find the images section
    image_section = main_content.find("div", class_="image50")
    if not image_section:
        logger.warning(f"No image section found for: {link}")
        return False
    
    # Get all image divs
    images = image_section.find_all("div")
    new_image_paths = []
    
    # Skip the first image (index 0) and scrape the rest
    for i, image in enumerate(images[1:], 1):  # Start from index 1
        image_link = image.find("a")
        if image_link:
            image_link = image_link.get("href")
            if image_link:
                file_name = "{}.jpg".format(uuid4())
                folder = os.path.join("images", "sumai", str(property_id))
                image_path = save_image(image_link, file_name, folder)
                if image_path:
                    new_image_paths.append(image_path)
                    logger.info(f"Saved additional image {i}: {image_path}")
    
    if new_image_paths:
        # Update the document with the new images (keeping existing ones)
        all_images = existing_images + new_image_paths
        thread_collection.update_one(
            {"_id": property_id},
            {"$set": {"images": all_images}}
        )
        logger.info(f"Updated document with {len(new_image_paths)} additional images. Total images: {len(all_images)}")
        return True
    else:
        logger.info(f"No additional images found for: {link}")
        return False


# --- FUNCTION TO PROCESS A SINGLE DOCUMENT ---
def process_document(doc):
    """Process a single document to scrape additional images"""
    try:
        return scrape_additional_images(doc)
    except Exception as e:
        logger.error(f"Error processing document {doc.get('_id')}: {str(e)}")
        return False


# --- MAIN LOOP ---
def main():
    """Loop through all documents in sumai collection and scrape additional images for documents with only 1 image using parallel processing"""
    logger.info("Starting parallel image update process for sumai collection...")
    
    # Find all documents that have only 1 image
    query = {
        "images": {"$exists": True, "$size": 1},
        "link": {"$exists": True}
    }
    
    # Get all documents at once
    documents = list(collection.find(query))
    document_count = len(documents)
    
    logger.info(f"Found {document_count} documents with only 1 image")
    
    if document_count == 0:
        logger.info("No documents to process")
        return
    
    updated = 0
    
    # Process documents in parallel using ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all tasks
        futures = [executor.submit(process_document, doc) for doc in documents]
        
        # Process completed tasks
        for i, future in enumerate(as_completed(futures), 1):
            try:
                result = future.result()
                if result:
                    updated += 1
                logger.info(f"Processed document {i}/{document_count}")
            except Exception as e:
                logger.error(f"Future resulted in error: {str(e)}")
    
    logger.info(f"Parallel image update process complete. Processed: {document_count}, Updated: {updated}")

if __name__ == "__main__":
    main()