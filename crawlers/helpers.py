from secrets import randbelow
import deepl
import requests
import os
import logging
import re
import random
from config import settings
from currency_converter import CurrencyConverter
import logging.handlers

def translate_text(text, target_lang="EN-US"):
    auth_key = settings.DEEPL_API_KEY
    translator = deepl.Translator(auth_key)

    result = translator.translate_text(text, target_lang=target_lang)
    return result.text


def save_image(image_url, filename, folder):
    try:
        os.makedirs(folder, exist_ok=True)
        response = requests.get(image_url, timeout=10)

        if response.status_code == 200:
            path = os.path.join(folder, filename)
            with open(path, 'wb') as f:
                f.write(response.content)
            return path
        else:
            logging.error(f"Failed to download image. Status code: {response.status_code}")
            return None
    except Exception as e:
        logging.error(f"Error downloading image: {e}")
        return None


def setup_logger(logger_name, log_file_base):
    """
    Sets up a logger with rotating file handlers:
    - One for warnings and errors only.
    - One for info-level and above (including warnings and errors).
    
    Args:
        logger_name (str): Name of the logger (e.g., 'nifty', 'sumai').
        log_file_base (str): Base name for log files (e.g., 'nifty', 'sumai').

    Returns:
        logging.Logger: Configured logger instance.
    """
    log_dir = settings.LOG_DIR
    os.makedirs(log_dir, exist_ok=True)

    # Handler for warnings and errors
    error_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, f'{log_file_base}_error.log'), maxBytes=1048576, backupCount=3)
    error_handler.setLevel(logging.WARNING)
    error_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))

    # Handler for info and above
    info_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, f'{log_file_base}_info.log'), maxBytes=1048576, backupCount=3)
    info_handler.setLevel(logging.INFO)
    info_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))

    # Setup logger
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)  # Allow all messages INFO and above

    # Clear existing handlers
    logger.handlers = []

    # Add both handlers
    logger.addHandler(info_handler)
    logger.addHandler(error_handler)

    return logger


def get_table_field_english(field):
    japanese_to_english = {
        "物件種別": "Property Type",
        "売買価格": "Sale Price",
        "賃貸価格": "Rental Price",
        "物件所在地": "Property Location",
        "建物-構造": "Building - Structure",
        "建物-築年月": "Building - Construction Date",
        "建物-面積": "Building - Area",
        "建物-間取": "Building - Layout",
        "土地-面積": "Land - Area",
        "土地-地目": "Land - Land Use",
        "土地-用途地域": "Land - Zoning",
        "土地-都市計画": "Land - Urban Planning",
        "土地-接道": "Land - Road Access",
        "土地-権利": "Land - Title",
        "駐車場": "Parking",
        "交通": "Transportation",
        "生活環境": "Living Environment",
        "設備-電気": "Utilities - Electricity",
        "設備-給湯": "Utilities - Hot Water",
        "設備-水道": "Utilities - Water Supply",
        "設備-排水": "Utilities - Drainage",
        "設備-トイレ": "Utilities - Toilet",
        "増築・リフォーム歴": "Renovation History",
        "補修必要程度": "Repair Needs",
        "補修費負担": "Repair Cost Responsibility",
        "補修必要内容": "Repair Details",
        "利用状況": "Usage Status",
        "付帯物件・その他": "Other Property Features",
        "管理費・自治会費・税金等": "Management Fees, Local Dues, Taxes, etc.",
        "敷金・礼金・仲介手数料等": "Deposit, Key Money, Agent Fees, etc.",
        "特記事項": "Special Notes",
        "備考": "Remarks",
        "参照URL": "Reference URL",
        "物件番号": "Property ID",
        "取引態様": "Transaction Type",
        "事業者名": "Business Name",
        "事業者所在地": "Business Address",
        "事業者連絡先": "Business Contact",
        "掲載日": "Listing Date",
        "掲載期限": "Listing Expiry",
        "直通メールフォーム": "Direct Contact Form"
    }

    return japanese_to_english[field]


def get_property_type(property_type):
    japanese_to_english = {
        "新築一戸建て": "Newly Constructed Detached House",
        "中古一戸建て": "Used Detached House",
        "土地・売地": "Land for Sale",
        "新築マンション": "Newly Constructed Apartments",
        "中古マンション": "Used Apartments"
    }

    return japanese_to_english[property_type]


def get_area_label(label):
    japanese_to_english = {
        "土地面積": "Land - Area",
        "建ぺい率": "Building Coverage Ratio",
        "容積率": "Volume Ratio",
        "間取り": "Building - Layout",
        "建物面積": "Building - Area",
        "土地面積": "Land - Area",
        "築年月": "Building - Construction Date",
        "階建": "Building - Structure",
        "専有面積": "Building - Area",
        "所在階": "Building - Location Floor"
    }

    return japanese_to_english[label]


def extract_yen_amount(text):
    # Remove commas for easier parsing
    cleaned = text.lower().replace(',', '')
    
    match = re.search(r'([\d.]+)\s*(million|thousand)?\s*yen', cleaned)
    if not match:
        return None
    
    number = float(match.group(1))
    unit = match.group(2)

    if unit == 'million':
        number *= 1_000_000
    elif unit == 'thousand':
        number *= 1_000

    return int(number)


def convert_to_usd(yen_text):
    c = CurrencyConverter()
    yen = extract_yen_amount(yen_text)
    return round(c.convert(yen, 'JPY', 'USD'), 2)


def get_random_user_agent():
    user_agents = [
        # Chrome - Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/115.0.5790.171 Safari/537.36",

        # Chrome - macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/114.0.5735.134 Safari/537.36",

        # Firefox - Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:117.0) Gecko/20100101 Firefox/117.0",

        # Firefox - macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:116.0) Gecko/20100101 Firefox/116.0",

        # Edge - Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/115.0.5790.171 Safari/537.36 Edg/115.0.1901.183",

        # Safari - macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0_0) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    ]

    return random.choice(user_agents)