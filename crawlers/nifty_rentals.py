import time
import random
import requests
import pymongo
import urllib.parse
import os
import bson
from bs4 import BeautifulSoup
from uuid import uuid4
from helpers import translate_text, save_image, get_property_type, get_area_label
from config import settings

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

# --- REQUEST FUNCTION WITH JITTER AND BACKOFF ---
def fetch_with_backoff(url):
    backoff = INITIAL_BACKOFF
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=10, headers=headers)
            if response.status_code == 200:
                return response.text
            else:
                print(f"Non-200 status: {response.status_code}")
        except requests.RequestException as e:
            print(f"Request failed: {e}")

        # Exponential backoff with jitter
        jitter = random.uniform(0, backoff)
        print(f"Retrying in {jitter:.2f} seconds...")
        time.sleep(jitter)
        backoff *= 2

    print("Max retries exceeded.")
    return None


# --- SCRAPER FUNCTION ---
def scrape_page(url, page_num):
    url = url.format(page_num)
    print(url)
    html = fetch_with_backoff(url)
    if not html:
        return False

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    content = soup.find('ul', class_="box is-space-sm")

    # Get the listings from the content
    listings = content.find_all('li', recursive=False)

    if not listings:
        print(f"No listings found on page {page_num}")
        return False

    for listing in listings:

        # Get the property description
        description = listing.find("h2")
        if description:
            description = description.get_text(strip=True)

        # Get the property type
        property_type = "Rental"

        # Get the location / transportation
        info_container = listing.find("div", class_="box is-mobile-0 is-space-sm")
        loc_trans = info_container.find_all("div", class_="box is-flex")

        if len(loc_trans) >= 2:
            location = loc_trans[1].get_text(strip=True)
            transportation = loc_trans[0].get_text(strip=True)
        else:
            location = None
            transportation = None
        
        # Get the full building info
        info_container = listing.find("div", class_="bukken-info-items is-flex")
        if info_container:
            info = info_container.find_all("dl")
            total_floors = info[0].find("dd").get_text(strip=True)
            building_age = info[1].find("dd").get_text(strip=True)
            building_structure = info[2].find("dd").get_text(strip=True)
        else:
            total_floors = None
            building_age = None
            building_structure = None

        # Get the main img
        image_link = listing.find("div", class_="thumbnail-wrap is-contain is-width-200px is-4x3").find("img", class_="lazyload thumbnail")
        if image_link:
            main_image_link = image_link.get("data-src")

        # Now get the specific rental info
        rental_info = listing.find("table", class_="result-bukken-table")
        tbody = rental_info.find_all("tbody")
        for row in tbody:
            property_id = uuid4()
            listing_data = {"_id": bson.Binary.from_uuid(property_id)}

            # Get the link
            link_tag = row.find("a")

            # Get the href attribute
            link = link_tag["href"]
            if link[0] == "/":
                link = "https://myhome.nifty.com" + link_tag["href"]
            
             # Check if we already have this link in the DB. If so, stop
            exists = collection.find_one({"link": link}) is not None
            if exists:
                return False

            # Get the specific info
            info_container = row.find_all("tr")
            if info_container and len(info_container) >= 3:
                info_data = info_container[0].find_all("td")
                floor_number = info_data[2].get_text(strip=True)

                floor_plan_data = info_data[3].find_all("p")
                floor_plan = floor_plan_data[0].get_text(strip=True)
                floor_area = floor_plan_data[1].get_text(strip=True)

                rent = info_data[4].find("p", class_="text is-strong").get_text(strip=True)

                # save the main image first
                image_paths = []
                folder = os.path.join("images", "nifty", str(property_id))
                image_path = save_image(main_image_link, "{}.jpg".format(uuid4()), folder)
                image_paths.append(image_path)

                # Now get the specific image
                image_link = info_data[1].find("img")
                if image_link:
                    image_link = image_link.get("data-src")
                    file_name = "{}.jpg".format(uuid4())
                    folder = os.path.join("images", "nifty", str(property_id))
                    image_path = save_image(image_link, file_name, folder)
                    image_paths.append(image_path)
            

            listing_data["link"] = link
            listing_data["description"] = translate_text(description)
            listing_data["Property Type"] = property_type
            listing_data["Building - Structure"] = translate_text(building_structure) + " / " + translate_text(total_floors)
            listing_data["Building - Construction Date"] = translate_text(building_age)
            listing_data["Property Location"] = translate_text(location)
            listing_data["Transportation"] = translate_text(transportation)

            listing_data["Building - Layout"] = floor_plan
            listing_data["Building - Area"] = floor_area
            listing_data["Rental Price"] = translate_text(rent)
            listing_data["images"] = image_paths
            listing_data["Building - Floor Number"] = translate_text(floor_number)

            collection.insert_one(listing_data)

    return True


def get_cities_to_scrape(prefecture):
    url = f"https://myhome.nifty.com/rent/{prefecture}/city/?cityTab"
    html = fetch_with_backoff(url)
    if not html:
        return False, "html"

    soup = BeautifulSoup(html, "html.parser")

    # Find the main content on the page
    content = soup.find('main', id="main")
    cities_container = content.find(attrs={"data-contents-id": "search-condition-city"})

    # Find all cities
    cities_to_scrape = []
    cities = cities_container.find_all("li")
    for city in cities:
        link_tag = city.find("a")
        if link_tag:
            cities_to_scrape.append("https://myhome.nifty.com" + link_tag["href"] + "{}/?sort=regDate-desc")
    
    return cities_to_scrape


# --- MAIN LOOP ---
def main():
    prefectures = ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima", "tokyo", "kanagawa",
            "saitama", "chiba", "ibaraki", "tochigi", "gunma", "niigata", "yamanashi", "nagano", "toyama",
            "ishikawa", "fukui", "aichi", "gifu", "shizuoka", "mie", "osaka", "hyogo", "kyoto", "shiga",
            "nara", "wakayama", "hiroshima", "okayama", "tottori", "shimane", "yamaguchi", "tokushima",
            "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki",
            "kagoshima", "okinawa"]
    for prefecture in prefectures:
        cities_to_scrape = get_cities_to_scrape(prefecture)
        for city in cities_to_scrape:
            page = 1
            while True:
                print(f"Scraping area {prefecture}, city {city}, page {page}...")
                if not scrape_page(city, page):
                    break
                page += 1
            

    print("Scraping complete.")

if __name__ == "__main__":
    main()