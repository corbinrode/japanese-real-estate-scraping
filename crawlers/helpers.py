import deepl
import requests
import os
import logging
from config import settings


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
    Sets up a logger with rotating file handlers for info and error logs.
    Args:
        logger_name (str): Name of the logger (e.g., 'nifty', 'sumai').
        log_file_base (str): Base name for log files (e.g., 'nifty', 'sumai').
    Returns:
        logging.Logger: Configured logger instance.
    """
    import logging
    import logging.handlers
    import os
    log_dir = settings.LOG_DIR
    os.makedirs(log_dir, exist_ok=True)

    info_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, f'{log_file_base}.log'), maxBytes=1048576, backupCount=3)
    info_handler.setLevel(logging.INFO)
    info_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))

    error_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, f'{log_file_base}_error.log'), maxBytes=1048576, backupCount=3)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))

    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)
    logger.handlers = []
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