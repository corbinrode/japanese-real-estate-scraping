import math
from fastapi import APIRouter, Query
from typing import Optional
from core.database import db
from core.config import settings

router = APIRouter()

def get_all_listings_filtered(
    prefecture: Optional[str] = None,
    layout: Optional[str] = None,
    sale_price_min: Optional[int] = None,
    sale_price_max: Optional[int] = None,
    sort_by: Optional[str] = "createdAt",
    sort_order: Optional[str] = "desc",
    page: int = 1,
    limit: int = 20,
):
    query = {}

    if prefecture:
        query["Prefecture"] = prefecture
    if layout:
        query["Building - Layout"] = layout
    
    # Add price filtering to query - only include listings with numeric sale prices
    query["Sale Price"] = {"$exists": True, "$type": "number"}
    
    if sale_price_min is not None or sale_price_max is not None:
        if "Sale Price" not in query:
            query["Sale Price"] = {}
        if sale_price_min is not None:
            query["Sale Price"]["$gte"] = sale_price_min
        if sale_price_max is not None:
            query["Sale Price"]["$lte"] = sale_price_max

    # Map API parameter to database field name
    if sort_by == "sale_price":
        sort_field = "Sale Price"
    else:
        sort_field = "createdAt"
    sort_direction = 1 if sort_order == "asc" else -1

    all_results = []

    for coll_name in db.list_collection_names():
        collection = db[coll_name]
        cursor = collection.find(query, {
            "_id": 0,
            "Prefecture": 1,
            "Building - Layout": 1,
            "Sale Price": 1,
            "link": 1,
            "Building - Area": 1,
            "Land - Area": 1,
            "Building - Construction Date": 1,
            "Building - Structure": 1,
            "Property Type": 1,
            "Property Location": 1,
            "Transportation": 1,
            "createdAt": 1,
            "images": 1
        })
        all_results.extend(cursor)

    # Handle sorting with mixed data types - put strings at end
    def get_sort_value(item, field):
        value = item.get(field)
        if value is None:
            return float('inf') if sort_direction == -1 else float('-inf')
        
        # If it's already a number, use it
        if isinstance(value, (int, float)):
            return value
        
        # All strings go to the end (use a very large negative number for descending, very large positive for ascending)
        return float('-inf') if sort_direction == -1 else float('inf')
    
    all_results.sort(
        key=lambda x: get_sort_value(x, sort_field),
        reverse=(sort_direction == -1)
    )

    total_count = len(all_results)
    total_pages = math.ceil(total_count / limit)
    start = (page - 1) * limit
    end = start + limit
    paginated = all_results[start:end]

    return {
        "results": paginated,
        "total_count": total_count,
        "total_pages": total_pages,
        "current_page": page
    }



@router.get("/listings")
def get_listings(
    prefecture: Optional[str] = Query(None),
    layout: Optional[str] = Query(None),
    sale_price_min: Optional[int] = Query(None),
    sale_price_max: Optional[int] = Query(None),
    sort_by: Optional[str] = Query("createdAt", regex="^(createdAt|sale_price)$"),
    sort_order: Optional[str] = Query("desc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
):
    results = get_all_listings_filtered(
        prefecture=prefecture,
        layout=layout,
        sale_price_min=sale_price_min,
        sale_price_max=sale_price_max,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit
    )
    return results


@router.get("/unique-layouts")
def get_unique_building_layouts():
    unique_layouts = set()

    for coll_name in db.list_collection_names():
        collection = db[coll_name]
        # Only get layouts from documents where "Sale Price" exists and is a number
        query = {"Sale Price": {"$exists": True, "$type": "number"}}
        layouts = collection.distinct("Building - Layout", query)
        unique_layouts.update(filter(None, layouts))  # Remove None values if any

    return {"unique_layouts": sorted(unique_layouts)}