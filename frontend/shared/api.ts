/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

import { getPrefectureDisplay } from "./real-estate";

// API base URL - adjust based on your environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Backend data structure interfaces
export interface BackendListing {
  Prefecture: string;
  "Building - Layout"?: string;
  "Sale Price"?: number;
  link?: string;
  "Building - Area"?: number;
  "Land - Area"?: number;
  "Building - Construction Date"?: string;
  "Building - Structure"?: string;
  "Property Type"?: string;
  "Property Location"?: string;
  Transportation?: string;
  createdAt: string;
  images?: string[];
}

export interface BackendListingsResponse {
  results: BackendListing[];
  total_count: number;
  total_pages: number;
  current_page: number;
}

export interface BackendLayoutsResponse {
  unique_layouts: string[];
}

// Frontend data structure (matching the updated RealEstateListing interface)
export interface RealEstateListing {
  id: string;
  title: string;
  prefecture: string;
  price?: number;
  floorPlan?: string;
  area?: string; // Changed to string since backend includes m²
  landArea?: string; // Changed to string since backend includes m²
  address?: string;
  imageUrl: string;
  yearBuilt?: string; // Changed to string since backend returns descriptive dates
  listingDate: string;
  description: string;
  features: string[];
  propertyType?: string;
  transportation?: string;
  buildingStructure?: string;
}

// API client functions
export class RealEstateAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getListings(params: {
    prefecture?: string;
    layout?: string;
    sale_price_min?: number;
    sale_price_max?: number;
    sort_by?: 'createdAt' | 'sale_price';
    sort_order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}): Promise<BackendListingsResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    const endpoint = `/v1/listings/listings?${searchParams.toString()}`;
    return this.fetchAPI<BackendListingsResponse>(endpoint);
  }

  async getUniqueLayouts(): Promise<BackendLayoutsResponse> {
    return this.fetchAPI<BackendLayoutsResponse>('/v1/listings/unique-layouts');
  }

  // Helper function to transform backend data to frontend format
  transformBackendListing(backendListing: BackendListing, index: number): RealEstateListing {
    // Generate a unique ID if not available
    const id = backendListing.link ? 
      backendListing.link.split('/').pop() || index.toString() : 
      index.toString();

    // Generate a title based on available data
    const title = backendListing["Property Type"] && backendListing["Property Location"] ?
      `${backendListing["Property Type"]} in ${backendListing["Property Location"]}` :
      `Property in ${backendListing.Prefecture}`;

    // Use the first image from the images array if available, otherwise use a default placeholder
    let imageUrl: string;
    if (backendListing.images && backendListing.images.length > 0 && backendListing.images[0]) {
      // Use the first image from the array - remove the "images/" prefix since static server is mounted at /images
      const imagePath = backendListing.images[0];
      if (imagePath && typeof imagePath === 'string') {
        const cleanPath = imagePath.replace(/^images\//, ''); // Remove "images/" prefix if present
        imageUrl = `${API_BASE_URL}/images/${cleanPath}`;
      } else {
        // Use a simple placeholder if image path is invalid
        imageUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='Arial' font-size='16'%3ENo Image Available%3C/text%3E%3C/svg%3E";
      }
    } else {
      // Use a simple placeholder if no images are available
      imageUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='Arial' font-size='16'%3ENo Image Available%3C/text%3E%3C/svg%3E";
    }

    // Parse area values that already include "m²" - extract just the number
    const parseArea = (areaStr?: string): number | undefined => {
      if (!areaStr) return undefined;
      const match = areaStr.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : undefined;
    };

    return {
      id,
      title,
      prefecture: getPrefectureDisplay(backendListing.Prefecture || ""),
      price: backendListing["Sale Price"], // Keep USD prices
      floorPlan: backendListing["Building - Layout"],
      area: backendListing["Building - Area"]?.toString(),
      landArea: backendListing["Land - Area"]?.toString(),
      address: backendListing["Property Location"],
      imageUrl,
      yearBuilt: backendListing["Building - Construction Date"] ? 
        backendListing["Building - Construction Date"] : undefined,
      listingDate: backendListing.createdAt,
      description: `Beautiful property located in ${backendListing.Prefecture}. ${backendListing["Property Type"] ? `This ${backendListing["Property Type"].toLowerCase()} ` : ''}Perfect for modern living with great amenities.`,
      features: ["Modern amenities", "Great location", "Well maintained", "Good value"],
      propertyType: backendListing["Property Type"],
      transportation: backendListing.Transportation,
      buildingStructure: backendListing["Building - Structure"]
    };
  }
}

// Create a default API instance
export const realEstateAPI = new RealEstateAPI();

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}
