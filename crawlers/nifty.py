import time
import pymongo
import urllib.parse
import os
import bson
from bs4 import BeautifulSoup
from uuid import uuid4
from helpers import translate_text, save_image, get_property_type, get_area_label, setup_logger, convert_to_usd, fetch_with_backoff
from config import settings
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

BASE_URL = "https://myhome.nifty.com/shinchiku-ikkodate/{}/search/{}/?subtype=bnh,buh&b2=30000000&pnum=40&sort=regDate-desc"
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
        thread_local.collection = thread_local.db.nifty_collection
    return thread_local.collection

# DB config (for backward compatibility)
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data
collection = db.nifty_collection

# Set up logger
logger = setup_logger('nifty', 'nifty')


# --- SCRAPER FUNCTION ---
def scrape_page(prefecture, page_num):
    url = BASE_URL.format(prefecture, page_num)
    status_code, html = fetch_with_backoff(url, logger)
    if status_code != 200:
        return False

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    content = soup.find('ul', class_="box is-space-sm")

    # Get the listings from the content
    listings = content.find_all('li', recursive=False)

    if not listings:
        logger.warning(f"No listings found on page {page_num}")
        return False

    # Get thread-local database connection
    collection = get_db_connection()

    for listing in listings:
        property_id = uuid4()
        listing_data = {"_id": bson.Binary.from_uuid(property_id)}

        # get the link for the listing
        link_tag = listing.find("a")

        # Get the href attribute
        link = link_tag["href"]
        if link[0] == "/":
            link = "https://myhome.nifty.com" + link_tag["href"]
        
        # Check if we already have this link in the DB. If so, stop
        existing_doc = collection.find_one({"link": link})
        if existing_doc:
            logger.info(f"Scraping stopping. Link already exists: " + link)
            return False

        listing_data["link"] = link

        # Get the property type
        property_type = listing.find("span", class_="badge is-plain is-pj1 is-margin-right-xxs is-middle is-strong is-xs").get_text(strip=True)
        property_type = get_property_type(property_type)

        # Get the price
        price = listing.find("p").get_text(strip=True)
        price = translate_text(price)

        # Get the location / transportation
        loc_trans = listing.find_all("div", class_="box is-space-xs")
        if len(loc_trans) >= 2:
            loc_trans = loc_trans[1]
        else:
            loc_trans = loc_trans[0]
        
        loc_trans = loc_trans.find_all("span")
        if len(loc_trans) >= 2:
            transportation = loc_trans[0].get_text(strip=True)
            transportation = translate_text(transportation)

            location = loc_trans[1].get_text(strip=True)
            location = translate_text(location)
        else:
            transportation = None
            location = loc_trans[0].get_text(strip=True)
            location = translate_text(location)

        # Get the size information
        area_info = listing.find_all("div", class_="box is-flex is-middle is-nowrap is-gap-4px")
        for x in area_info:
            field = x.find("span", class_="badge is-plain is-grey-dark is-strong is-xxs").get_text(strip=True)
            field = get_area_label(field)

            value = x.find("span", class_="text is-sm").get_text(strip=True)
            value = translate_text(value)

            listing_data[field] = value

        # Scrape the actual listing for the contact number and images
        status_code, html2 = fetch_with_backoff(link, logger)
        if status_code != 200:
            logger.error("Problem fetching listing link: " + link)
            continue

        soup2 = BeautifulSoup(html2, "html.parser")

        contact_number = None
        listing_content = soup2.find('main')
        if "nifty" in link:

            # Get the contact number
            agent_info = listing_content.find("div", id="inquiryArea")
            if agent_info:
                # Find the phone number dt
                dt = agent_info.find('dt', string='電話番号')

                # Get the next <dd> sibling if it exists
                contact_number = dt.find_next_sibling('dd').text.strip() if dt else None
        elif "pitat" in link:

            # Get the contact number
            contact_div = listing_content.find('div', class_='detail-top-info__tel')
            main_div = contact_div.find('div', class_='main')
            contact_number = main_div.get_text(strip=True) if main_div else None   
        

        listing_data["Sale Price"] = convert_to_usd(price)
        listing_data["Sale Price Yen"] = price
        listing_data["Property Type"] = property_type
        listing_data["Property Location"] = location
        listing_data["Transportation"] = transportation
        listing_data["Contact Number"] = contact_number
        listing_data["Prefecture"] = prefecture
        listing_data["createdAt"] = datetime.datetime.now(datetime.timezone.utc)

        # Get the images
        print(link)
        image_paths = []
        if "nifty" in link:
            main_div = soup2.find('div', id='summary')
            thumbnails = main_div.find_all('img', class_='thumbnail')

            # Deduplicate while preserving order
            seen = set()
            img_urls = []
            for img in thumbnails:
                src = img['src']
                if src not in seen:
                    seen.add(src)
                    img_urls.append(src)

            for img in img_urls:
                file_name = "{}.jpg".format(uuid4())
                folder = os.path.join("images", "nifty", str(property_id))
                image_path = save_image(img, file_name, folder)
                image_paths.append(image_path)

        listing_data["images"] = image_paths

        collection.insert_one(listing_data)

    return True

# --- MAIN LOOP ---
def process_prefecture(prefecture):
    """Process a single prefecture - this function will be run in parallel"""
    logger.info(f"Starting to process prefecture: {prefecture}")
    page = 1
    total_pages = 0
    
    while True:
        logger.info(f"Scraping area {prefecture}, page {page}...")
        try:
            if not scrape_page(prefecture, page):
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
    
    # Configuration for parallel processing
    # Adjust these values based on your system capabilities and rate limiting needs
    max_workers = MAX_WORKERS  # Number of concurrent threads
    # You can also set this based on CPU cores: max_workers = min(32, (os.cpu_count() or 1) + 4)
    
    logger.info(f"Starting parallel processing with {max_workers} workers for {len(prefectures)} prefectures")
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all prefectures for processing
        future_to_prefecture = {executor.submit(process_prefecture, prefecture): prefecture 
                            for prefecture in prefectures}
        
        # Process completed tasks as they finish
        completed_prefectures = []
        failed_prefectures = []
        
        for future in as_completed(future_to_prefecture):
            prefecture = future_to_prefecture[future]
            try:
                prefecture_name, pages_processed = future.result()
                completed_prefectures.append((prefecture_name, pages_processed))
                logger.info(f"Completed: {prefecture_name} - {pages_processed} pages")
            except Exception as e:
                failed_prefectures.append(prefecture)
                logger.error(f"Prefecture {prefecture} generated an exception: {e}")
    
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