import re
import time
import random
import requests
import pymongo
import urllib.parse
import os
import bson
from bs4 import BeautifulSoup
from uuid import uuid4
from helpers import translate_text, save_image, setup_logger, get_random_user_agent
from config import settings
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from uuid import UUID

# Set up logger
logger = setup_logger('nifty_updates', 'nifty_updates')

MAX_RETRIES = 5
INITIAL_BACKOFF = 30  # in seconds
MAX_WORKERS = 6  # Parallel workers for processing documents

# Thread-local storage for database connections
thread_local = threading.local()

def get_db_connection():
    """Get thread-local database connection"""
    if not hasattr(thread_local, 'client'):
        user = urllib.parse.quote_plus(settings.DB_USER)
        password = urllib.parse.quote_plus(settings.DB_PASSWORD)
        thread_local.client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
        thread_local.db = thread_local.client.crawler_data
        thread_local.collection = thread_local.db.nifty_collection
    return thread_local.collection

# Main DB config
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data
collection = db.nifty_collection

headers = {
    "User-Agent": get_random_user_agent()
}

proxies = {
    "http": f"http://{settings.ZYTE_API_KEY}:@proxy.zyte.com:8011",
    "https": f"http://{settings.ZYTE_API_KEY}:@proxy.zyte.com:8011",
}

# --- REQUEST FUNCTION WITH JITTER AND BACKOFF ---
def fetch_with_backoff(url):
    backoff = INITIAL_BACKOFF
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=10, headers=headers, proxies=proxies)
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


# --- FUNCTION TO SCRAPE ADDITIONAL IMAGES AND CONTACT NUMBER ---
def scrape_additional_data(document):
    """Scrape additional images and contact number for a document"""
    link = document.get("link")
    property_id = document.get("_id")
    existing_images = document.get("images", [])
    existing_contact = document.get("Contact Number")
    
    if not link:
        logger.warning(f"No link found for document {property_id}")
        return False
    
    logger.info(f"Scraping additional data for: {link}")
    
    # Add a small delay to be respectful to the server
    time.sleep(random.uniform(1, 3))
    
    # Fetch the listing page
    api_response = requests.post(
        "https://api.zyte.com/v1/extract",
        auth=(settings.ZYTE_API_KEY, ""),
        json={
            "url": link,
            "browserHtml": True,
        }
    )
    html = api_response.json()["browserHtml"]
    if not html:
        logger.error(f"Problem fetching listing link: {link}")
        return False

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    listing_content = soup.find('main')
    if not listing_content:
        logger.error(f"Could not find main content for: {link}")
        return False

    updated = False
    
    # Get thread-local database connection
    thread_collection = get_db_connection()
    
    # Convert binary UUID to proper string format
    if isinstance(property_id, bson.Binary):
        property_id_str = str(UUID(bytes=property_id))
    else:
        property_id_str = str(property_id)
    
    # Scrape contact number if missing
    if not existing_contact:
        contact_number = None
        
        if "nifty" in link:
            # Get the contact number for nifty links
            agent_info = listing_content.find("div", id="inquiryArea")
            if agent_info:
                # Find the phone number dt
                dt = agent_info.find('dt', string='電話番号')
                # Get the next <dd> sibling if it exists
                contact_number = dt.find_next_sibling('dd').text.strip() if dt else None
                
        elif "pitat" in link:
            # Get the contact number for pitat links
            contact_div = listing_content.find('div', class_='detail-top-info__tel')
            if contact_div:
                main_div = contact_div.find('div', class_='main')
                contact_number = main_div.get_text(strip=True) if main_div else None
        
        if contact_number:
            thread_collection.update_one(
                {"_id": property_id},
                {"$set": {"Contact Number": contact_number}}
            )
            logger.info(f"Updated contact number: {contact_number}")
            updated = True
    
    # Scrape additional images if document only has 1 image
    if len(existing_images) == 1:
        new_image_paths = []
        
        if "nifty" in link:
            main_div = soup.find('div', id='summary')
            if main_div:
                thumbnails = main_div.find_all('img', class_='thumbnail')

                # Deduplicate while preserving order
                seen = set()
                img_urls = []
                for img in thumbnails:
                    src = img['src']
                    if src not in seen:
                        seen.add(src)
                        img_urls.append(src)

                # Skip the first image and scrape the rest
                if len(img_urls) > 1:
                    additional_img_urls = img_urls[1:]  # Skip first image
                    
                    for img_url in additional_img_urls:
                        file_name = "{}.jpg".format(uuid4())
                        folder = os.path.join("images", "nifty", property_id_str)
                        image_path = save_image(img_url, file_name, folder)
                        if image_path:
                            new_image_paths.append(image_path)
                            logger.info(f"Saved additional image: {image_path}")
                else:
                    logger.info(f"No additional images found for: {link}")
            else:
                logger.warning(f"No summary div found for: {link}")
        else:
            # For non-nifty links, we might not have image scraping logic
            logger.info(f"Skipping image scraping for non-nifty link: {link}")
        
        if new_image_paths:
            # Update the document with the new images (keeping existing ones)
            all_images = existing_images + new_image_paths
            thread_collection.update_one(
                {"_id": property_id},
                {"$set": {"images": all_images}}
            )
            logger.info(f"Updated document with {len(new_image_paths)} additional images. Total images: {len(all_images)}")
            updated = True
    
    return updated


# --- FUNCTION TO PROCESS A SINGLE DOCUMENT ---
def process_document(doc):
    """Process a single document to scrape additional images and contact number"""
    try:
        return scrape_additional_data(doc)
    except Exception as e:
        logger.error(f"Error processing document {doc.get('_id')}: {str(e)}")
        return False


# --- MAIN LOOP ---
def main():
    """Loop through documents and scrape additional images/contact numbers using parallel processing"""
    logger.info("Starting parallel update process for nifty collection...")
    
    # Find all documents that need updates:
    # 1. Documents with only 1 image, OR
    # 2. Documents missing contact number
    query = {
        "$or": [
            {"images": {"$exists": True, "$size": 1}},
            {"Contact Number": {"$exists": False}},
            {"Contact Number": None},
            {"Contact Number": ""}
        ],
        "link": {"$exists": True}
    }
    
    # Get all documents at once
    documents = list(collection.find(query).sort("createdAt", -1))
    document_count = len(documents)
    
    logger.info(f"Found {document_count} documents that need updates")
    
    if document_count == 0:
        logger.info("No documents to process")
        return
    
    # Count documents by update type for reporting
    single_image_count = collection.count_documents({
        "images": {"$exists": True, "$size": 1},
        "link": {"$exists": True}
    })
    
    missing_contact_count = collection.count_documents({
        "$or": [
            {"Contact Number": {"$exists": False}},
            {"Contact Number": None},
            {"Contact Number": ""}
        ],
        "link": {"$exists": True}
    })
    
    logger.info(f"Documents with 1 image: {single_image_count}")
    logger.info(f"Documents missing contact number: {missing_contact_count}")
    
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
    
    logger.info(f"Parallel update process complete. Processed: {document_count}, Updated: {updated}")

if __name__ == "__main__":
    main()