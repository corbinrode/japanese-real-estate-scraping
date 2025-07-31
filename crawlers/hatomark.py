from math import e
import time
import random
import requests
import pymongo
import urllib.parse
import os
import bson
from bs4 import BeautifulSoup
from uuid import uuid4
from helpers import translate_text, save_image, get_property_type, get_area_label, setup_logger, convert_to_usd
from config import settings
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

BASE_URL = "https://www.hatomarksite.com/search/zentaku/buy/house/area/{}/list?price_b_from=&price_b_to=30000000&key_word=&land_area_all_from=&land_area_all_to=&land_area_unit=UNIT30&bld_area_from=&bld_area_to=&bld_area_unit=UNIT30&eki_walk=&expected_return_from=&expected_return_to=&limit=20&sort1=ASRT33&page={}"
MAX_RETRIES = 5
INITIAL_BACKOFF = 30 # in seconds
MAX_WORKERS = 4

# Thread-local storage for database connections
thread_local = threading.local()

def get_db_connection():
    """Get thread-local database connection"""
    if not hasattr(thread_local, 'client'):
        user = urllib.parse.quote_plus(settings.DB_USER)
        password = urllib.parse.quote_plus(settings.DB_PASSWORD)
        thread_local.client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
        thread_local.db = thread_local.client.crawler_data
        thread_local.collection = thread_local.db.hatomark_collection
    return thread_local.collection

# DB config (for backward compatibility)
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data
collection = db.hatomark_collection

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

# Set up logger
logger = setup_logger('hatomark', 'hatomark')


# --- REQUEST FUNCTION WITH JITTER AND BACKOFF ---
def fetch_with_backoff(url):
    backoff = INITIAL_BACKOFF
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=10, headers=headers)
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


# --- SCRAPER FUNCTION ---
def scrape_page(num, prefecture, page_num):
    url = BASE_URL.format(num, page_num)
    html = fetch_with_backoff(url)
    if not html:
        return False

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    content = soup.find("div", class_="row g-4 list-table")

    # Get the listings from the content
    listings = content.find_all('div', class_="col-12", recursive=False)

    if not listings:
        logger.warning(f"No listings found on page {page_num}")
        return False

    # Get thread-local database connection
    collection = get_db_connection()

    for listing in listings:
        property_id = uuid4()
        listing_data = {"_id": bson.Binary.from_uuid(property_id)}

        # get the link for the listing
        link_tag = listing.find("div", class_="box-footer col-12 mt-2").find("a")

        # Get the href attribute
        link = link_tag["href"]

        # Check if we already have this link in the DB. If so, stop
        existing_doc = collection.find_one({"link": link})
        if existing_doc:
            logger.info(f"Scraping stopping. Link already exists: " + link)
            return False

        listing_data["link"] = link

        # Get the property type
        property_type = listing.find("div", class_="tag-list").find_all("p")[0].get_text(strip=True)
        property_type = translate_text(property_type)

        # get the location
        location_div = listing.find("div", class_="mb-1 address")
        if location_div.a:
            location_div.a.decompose() 
        location = location_div.get_text(strip=True)
        location = translate_text(location)

        # get the transportation
        transportation = []
        trans_div = listing.find("div", class_="mb-1 traffic")
        all_trans = trans_div.find_all("div")
        for div in all_trans:
            if div.a:
                div.a.decompose
            transportation.append(translate_text(div.get_text(strip=True)))
        transportation = " / ".join(transportation)
        
        main_info_div = listing.find("div", class_="row g-2 row-cols-2")
        info_divs = main_info_div.find_all("div")

        # Get the price
        price = None
        if len(info_divs) >= 1:
            price = info_divs[0].find("p").get_text(strip=True)
            price = translate_text(price)
        
        # Get the building date
        building_date = None
        if len(info_divs) >= 2:
            building_date = info_divs[1].find("p").get_text(strip=True)
            building_date = translate_text(building_date)

        # Get the land area
        land_area = None
        if len(info_divs) >= 3:
            land_area = info_divs[2].find("p").get_text(strip=True)
            land_area = translate_text(land_area)

        # Get the building area
        building_area = None
        if len(info_divs) >= 4:
            building_area = info_divs[3].find("p").get_text(strip=True)
            building_area = translate_text(building_area)

        # Get the number of floors
        floors = None
        if len(info_divs) >= 5:
            floors = info_divs[4].find("p").get_text(strip=True)
            floors = translate_text(floors)

        # Get the floor plan
        floor_plan = None
        if len(info_divs) >= 6:
            floor_plan = info_divs[5].find("p").get_text(strip=True)
            floor_plan = translate_text(floor_plan)

        # Scrape the actual listing for the contact number and images
        html2 = fetch_with_backoff(link)
        if not html2:
            logger.error("Problem fetching listing link: " + link)
            continue

        soup2 = BeautifulSoup(html2, "html.parser")

        # Find the main content on the page
        listing_content = soup2.find('main')

        # Get the contact number
        contact_number = None
        agent_info = listing_content.find("div", class_="info-agent")
        for div in agent_info.find_all('div', class_='col d-flex align-items-center'):
            label = div.find('p', class_='room-detail-title')
            if label and 'TEL' in label.get_text(strip=True):
                # Get the next <p> tag which contains the phone number
                phone_tag = label.find_next_sibling('p')
                if phone_tag:
                    contact_number = phone_tag.get_text(strip=True)
            

        listing_data["Sale Price"] = convert_to_usd(price)
        listing_data["Sale Price Yen"] = price
        listing_data["Property Type"] = property_type
        listing_data["Property Location"] = location
        listing_data["Transportation"] = transportation
        listing_data["Building - Construction Date"] = building_date
        listing_data["Land - Area"] = land_area
        listing_data["Building - Area"] = building_area
        listing_data["Building - Structure"] = floors
        listing_data["Building - Layout"] = floor_plan
        listing_data["Contact Number"] = contact_number
        listing_data["Prefecture"] = prefecture
        listing_data["createdAt"] = datetime.datetime.now(datetime.timezone.utc)

        # Get the images
        images = []
        for div in soup2.find_all('div', class_='slick-img'):
            data_index = div.get('data-index')
            img_tag = div.find('img')
            if data_index and img_tag:
                src = img_tag['src']
                images.append((int(data_index), src))

        # Remove duplicates (optional, based on data-index + src)
        unique_images = list(dict.fromkeys(images))  # preserves order

        # Sort by data-index
        sorted_images = sorted(unique_images, key=lambda x: x[0])

        # Extract only the image URLs
        image_urls = [url for _, url in sorted_images]

        image_paths = []
        for img in image_urls:
            image_link = img
            file_name = "{}.jpg".format(uuid4())
            folder = os.path.join("images", "hatomark", str(property_id))
            image_path = save_image(image_link, file_name, folder)
            image_paths.append(image_path)
   
        listing_data["images"] = image_paths

        collection.insert_one(listing_data)

    return True

# --- MAIN LOOP ---
def process_prefecture(prefecture_data):
    """Process a single prefecture - this function will be run in parallel"""
    prefecture, num = prefecture_data
    logger.info(f"Starting to process prefecture: {prefecture} (num: {num})")
    page = 1
    total_pages = 0
    
    while True:
        logger.info(f"Scraping area {prefecture}, page {page}...")
        try:
            if not scrape_page(num, prefecture, page):
                break
            total_pages += 1
        except Exception as e:
            logger.error(f"Unexpected error processing {prefecture}, page {page}: {str(e)}")
            break

        page += 1
    
    logger.info(f"Completed processing prefecture: {prefecture} (processed {total_pages} pages)")
    return prefecture, total_pages

def main():
    prefectures = ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima", "tokyo", "kanagawa",
            "saitama", "chiba", "ibaraki", "tochigi", "gunma", "niigata", "yamanashi", "nagano", "toyama",
            "ishikawa", "fukui", "aichi", "gifu", "shizuoka", "mie", "osaka", "hyogo", "kyoto", "shiga",
            "nara", "wakayama", "hiroshima", "okayama", "tottori", "shimane", "yamaguchi", "tokushima",
            "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki",
            "kagoshima", "okinawa"]

    # Create list of (prefecture, num) tuples for parallel processing
    prefecture_data = []
    for i in range(1, len(prefectures)+1):
        prefecture = prefectures[i-1]
        num = f"{i:02}"
        prefecture_data.append((prefecture, num))
    
    # Configuration for parallel processing
    # Adjust these values based on your system capabilities and rate limiting needs
    max_workers = MAX_WORKERS  # Number of concurrent threads
    # You can also set this based on CPU cores: max_workers = min(32, (os.cpu_count() or 1) + 4)
    
    logger.info(f"Starting parallel processing with {max_workers} workers for {len(prefecture_data)} prefectures")
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all prefectures for processing
        future_to_prefecture = {executor.submit(process_prefecture, data): data 
                              for data in prefecture_data}
        
        # Process completed tasks as they finish
        completed_prefectures = []
        failed_prefectures = []
        
        for future in as_completed(future_to_prefecture):
            prefecture_data = future_to_prefecture[future]
            prefecture_name = prefecture_data[0]
            try:
                prefecture_name, pages_processed = future.result()
                completed_prefectures.append((prefecture_name, pages_processed))
                logger.info(f"Completed: {prefecture_name} - {pages_processed} pages")
            except Exception as e:
                failed_prefectures.append(prefecture_name)
                logger.error(f"Prefecture {prefecture_name} generated an exception: {e}")
    
    # Summary
    end_time = time.time()
    total_time = end_time - start_time
    total_pages = sum(pages for _, pages in completed_prefectures)
    
    logger.info(f"Scraping complete in {total_time:.2f} seconds")
    logger.info(f"Successfully processed {len(completed_prefectures)} prefectures, {total_pages} total pages")
    if failed_prefectures:
        logger.warning(f"Failed to process {len(failed_prefectures)} prefectures: {failed_prefectures}")
    
    # Performance metrics
    if total_pages > 0:
        pages_per_second = total_pages / total_time
        logger.info(f"Performance: {pages_per_second:.2f} pages/second")

if __name__ == "__main__":
    main()