import pymongo
import urllib.parse
import os
import bson
from bs4 import BeautifulSoup
from uuid import uuid4
from helpers import translate_text, get_table_field_english, save_image, setup_logger, convert_to_usd, fetch_with_backoff
from config import settings
import datetime

# Set up logger
logger = setup_logger('sumai', 'sumai')


BASE_URL = "https://akiya.sumai.biz/category/%E5%A3%B2%E8%B2%B7%E4%BE%A1%E6%A0%BC%E5%B8%AF/page/{}"
MAX_RETRIES = 5
INITIAL_BACKOFF = 30  # in seconds

# DB config
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data
collection = db.sumai_collection


# --- SCRAPER FUNCTION ---
def scrape_page(page_num):
    url = BASE_URL.format(page_num)
    status_code, html = fetch_with_backoff(url, logger, follow_redirect=True)
    if status_code != 200:
        return False

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    content = soup.find('div', attrs={'id': 'content'})

    # Get the listings from the content
    listings = content.find_all('article')

    if not listings:
        logger.warning(f"No listings found on page {page_num}")
        return False

    for listing in listings:
        property_id = uuid4()
        listing_data = {"_id": bson.Binary.from_uuid(property_id)}

        # get the link for the listing
        link_tag = listing.find("header", class_="entry-header").find("h1", class_="entry-title").find("a")

        # Get the href attribute
        link = link_tag["href"]

        # Check if we already have this link in the DB. If so, stop
        existing_doc = collection.find_one({"link": link})
        if existing_doc:
            logger.info(f"Scraping stopping. Link already exists: " + link)
            return False

        listing_data["link"] = link

        # now that we have the link, scrape the specific listing
        status_code, html2 = fetch_with_backoff(link, logger)
        if status_code != 200:
            logger.error("Problem fetching listing link: " + link)
            continue

        soup2 = BeautifulSoup(html2, "html.parser")

        # Find the main content on the page
        listing_content = soup2.find('header', class_='entry-header')

        # find the listing description
        description = listing_content.find("h1", class_="entry-title").get_text(strip=True)
        description = translate_text(description)
        listing_data["description"] = description

        # Get the listing details
        main_content = listing_content.find("div", class_="entry-content")
        details = main_content.find("table").find_all("tr")
        for row in details:
            tds = row.find_all("td")
            if len(tds) >= 2:
                field = tds[0].get_text(strip=True)
                value = tds[1].get_text(strip=True)

                # convert japanese field to english
                field = get_table_field_english(field)

                if value:
                    value = translate_text(value)
                
                # get the referrer url if needed
                if field == "Reference URL":
                    value = tds[1].find("a").get("href")

                # populate listing_data for inserting to the DB
                listing_data[field] = value
            
            if len(tds) >= 4:
                field = tds[2].get_text(strip=True)
                value = tds[3].get_text(strip=True)

                # convert japanese field to english
                field = get_table_field_english(field)

                if value:
                    value = translate_text(value)

                # populate listing_data for inserting to the DB
                listing_data[field] = value
        
        # Now get the listing images
        images = main_content.find("div", class_="image50").find_all("div")
        image_paths = []
        for image in images:
            image_link = image.find("a")
            if image_link:
                image_link = image_link.get("href")
                file_name = "{}.jpg".format(uuid4())
                folder = os.path.join("images", "sumai", str(property_id))
                image_path = save_image(image_link, file_name, folder)
                image_paths.append(image_path)
        
        listing_data["images"] = image_paths

        # Update the sale price
        if "Sale Price" in listing_data and listing_data["Sale Price"]:
            listing_data["Sale Price Yen"] = listing_data["Sale Price"]
            listing_data["Sale Price"] = convert_to_usd(listing_data["Sale Price"])
        
        # Store the prefecture separately
        if "Property Location" in listing_data and listing_data["Property Location"]:
            loc_parts = listing_data["Property Location"].split(",")
            if len(loc_parts) > 2:
                listing_data["Prefecture"] = loc_parts[-1].strip().lower()

        listing_data["createdAt"] = datetime.datetime.now(datetime.timezone.utc)
        collection.insert_one(listing_data)

    return True

# --- MAIN LOOP ---
def main():
    page = 1
    while True:
        logger.info(f"Scraping page {page}...")
        try:
            if not scrape_page(page):
                break
        except Exception as e:
            logger.error("Unexpected error: " + str(e))
        page += 1

    logger.info("Scraping complete.")

if __name__ == "__main__":
    main()