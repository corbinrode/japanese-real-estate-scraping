import os
import re
import shutil
import pymongo
import urllib.parse
import bson
from uuid import UUID
from config import settings
from helpers import setup_logger

# Set up logger
logger = setup_logger('fix_binary_paths', 'fix_binary_paths')

# DB config
user = urllib.parse.quote_plus(settings.DB_USER)
password = urllib.parse.quote_plus(settings.DB_PASSWORD)
client = pymongo.MongoClient("mongodb://%s:%s@%s:%s" % (user, password, settings.DB_HOST, settings.DB_PORT))
db = client.crawler_data

# Collections to fix
collections = {
    'sumai_collection': 'sumai',
    'hatomark_collection': 'hatomark', 
    'nifty_collection': 'nifty'
}

def extract_binary_uuid_from_path(path):
    """Extract binary UUID representation from file path"""
    # Look for pattern like b'...' in the path
    match = re.search(r"b'([^']*)'", path)
    if match:
        return match.group(0)  # Return the full b'...' part
    return None

def binary_string_to_uuid(binary_str):
    """Convert binary string representation back to proper UUID"""
    try:
        # Remove b' and ' from the string
        hex_str = binary_str[2:-1]
        # Convert escaped characters back to bytes
        byte_data = bytes([ord(c) for c in hex_str])
        # Create UUID from bytes
        uuid_obj = UUID(bytes=byte_data)
        return str(uuid_obj)
    except Exception as e:
        logger.error(f"Failed to convert binary string {binary_str}: {e}")
        return None

def fix_collection_paths(collection_name, folder_name):
    """Fix binary UUID paths for a specific collection"""
    collection = db[collection_name]
    logger.info(f"Processing collection: {collection_name}")
    
    # Find documents with more than one image (these are the ones processed by update scripts)
    pipeline = [
        {"$match": {"images": {"$exists": True}}},
        {"$match": {"$expr": {"$gt": [{"$size": "$images"}, 1]}}}
    ]
    documents = list(collection.aggregate(pipeline))
    logger.info(f"Found {len(documents)} documents with more than one image")
    
    fixed_count = 0
    error_count = 0
    
    for doc in documents:
        document_id = doc['_id']
        images = doc.get('images', [])
        
        if not images:
            continue
            
        # Check if any image paths contain binary representations
        needs_fixing = any("b'" in str(img_path) for img_path in images)
        
        if not needs_fixing:
            continue
            
        logger.info(f"Fixing document {document_id}")
        
        # Convert binary UUID to proper string
        if isinstance(document_id, bson.Binary):
            proper_uuid = str(UUID(bytes=document_id))
        else:
            proper_uuid = str(document_id)
            
        new_images = []
        files_moved = 0
        
        for img_path in images:
            img_path_str = str(img_path)
            
            # Check if this path contains binary representation
            binary_part = extract_binary_uuid_from_path(img_path_str)
            
            if binary_part:
                # Create new path with proper UUID
                new_path = img_path_str.replace(binary_part, proper_uuid)
                new_images.append(new_path)
                
                # Move the actual file
                old_full_path = os.path.join("/home/admin/japanese-real-estate-scraping/crawlers", img_path_str)
                new_full_path = os.path.join("/home/admin/japanese-real-estate-scraping/crawlers", new_path)
                
                try:
                    if os.path.exists(old_full_path):
                        # Create new directory if it doesn't exist
                        os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
                        
                        # Move the file
                        shutil.move(old_full_path, new_full_path)
                        logger.info(f"Moved: {old_full_path} -> {new_full_path}")
                        files_moved += 1
                        
                        # Try to remove old empty directory
                        old_dir = os.path.dirname(old_full_path)
                        try:
                            if os.path.exists(old_dir) and not os.listdir(old_dir):
                                os.rmdir(old_dir)
                                logger.info(f"Removed empty directory: {old_dir}")
                        except OSError:
                            pass  # Directory not empty or other issue, ignore
                    else:
                        logger.warning(f"File not found: {old_full_path}")
                        # Still update the path in database even if file doesn't exist
                        
                except Exception as e:
                    logger.error(f"Error moving file {old_full_path}: {e}")
                    error_count += 1
                    # Use old path if move failed
                    new_images.append(img_path)
                    continue
                    
            else:
                # Path is already correct, keep as-is
                new_images.append(img_path)
        
        # Update database with new paths
        try:
            collection.update_one(
                {"_id": document_id},
                {"$set": {"images": new_images}}
            )
            logger.info(f"Updated database for document {document_id}, moved {files_moved} files")
            fixed_count += 1
            
        except Exception as e:
            logger.error(f"Error updating database for document {document_id}: {e}")
            error_count += 1
    
    logger.info(f"Collection {collection_name}: Fixed {fixed_count} documents, {error_count} errors")
    return fixed_count, error_count

def main():
    """Fix binary UUID paths in all collections"""
    logger.info("Starting binary UUID path fix process...")
    
    total_fixed = 0
    total_errors = 0
    
    for collection_name, folder_name in collections.items():
        try:
            fixed, errors = fix_collection_paths(collection_name, folder_name)
            total_fixed += fixed
            total_errors += errors
        except Exception as e:
            logger.error(f"Error processing collection {collection_name}: {e}")
            total_errors += 1
    
    logger.info(f"Binary UUID fix complete. Total fixed: {total_fixed}, Total errors: {total_errors}")

if __name__ == "__main__":
    main() 