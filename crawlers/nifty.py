import time
import random
import requests
import pymongo
import urllib.parse
import os
import bson
from bs4 import BeautifulSoup
from uuid import uuid4
from helpers import translate_text, save_image, get_property_type, get_area_label, setup_logger
from config import settings

BASE_URL = "https://myhome.nifty.com/shinchiku-ikkodate/{}/search/{}/?subtype=bnh,buh&b2=30000000&pnum=40&sort=regDate-desc"
MAX_RETRIES = 5
INITIAL_BACKOFF = 0.5  # in seconds

# DB config
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data
collection = db.nifty_collection

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

# Set up logger
logger = setup_logger('nifty', 'nifty')


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
def scrape_page(prefecture, page_num):
    url = BASE_URL.format(prefecture, page_num)
    logger.info(url)
    html = fetch_with_backoff(url)
    if not html:
        return False

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    content = soup.find('ul', class_="box is-space-sm")

    # Get the listings from the content
    listings = content.find_all('li', recursive=False)

    if not listings:
        logger.warning(f"No listings found on page {page_num}")
        return False

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
        exists = collection.find_one({"link": link}) is not None
        if exists:
            return False

        listing_data["link"] = link

        # Get the property type
        property_type = listing.find("span", class_="badge is-plain is-pj1 is-margin-right-xxs is-middle is-strong is-xs").get_text(strip=True)
        property_type = get_property_type(property_type)

        logger.info(link)

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


        listing_data["Sale Price"] = price
        listing_data["Property Type"] = property_type
        listing_data["Property Location"] = location
        listing_data["Transportation"] = transportation

        # Get the img
        image_paths = []
        image_link = listing.find("img")
        if image_link:
            image_link = image_link.get("src")
            file_name = "{}.jpg".format(uuid4())
            folder = os.path.join("images", "nifty", str(property_id))
            image_path = save_image(image_link, file_name, folder)
            image_paths.append(image_path)

            
        listing_data["images"] = image_paths

        collection.insert_one(listing_data)

    return True

# --- MAIN LOOP ---
def main():
    prefectures = ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima", "tokyo", "kanagawa",
            "saitama", "chiba", "ibaraki", "tochigi", "gunma", "niigata", "yamanashi", "nagano", "toyama",
            "ishikawa", "fukui", "aichi", "gifu", "shizuoka", "mie", "osaka", "hyogo", "kyoto", "shiga",
            "nara", "wakayama", "hiroshima", "okayama", "tottori", "shimane", "yamaguchi", "tokushima",
            "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki",
            "kagoshima", "okinawa"]
    for prefecture in prefectures:
        page = 1
        while True:
            logger.info(f"Scraping area {prefecture}, page {page}...")
            if not scrape_page(prefecture, page):
                break
            page += 1

    logger.info("Scraping complete.")

if __name__ == "__main__":
    main()