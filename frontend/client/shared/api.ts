/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

import { getPrefectureDisplay } from "./real-estate";

// API base URL - adjust based on your environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Authentication types
export interface LoginCredentials {
  username: string; // FastAPI OAuth2PasswordRequestForm uses 'username' field
  password: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  payment_provider: string;
  stripe_subscription_id?: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  subscription?: Subscription;
}

export interface SubscriptionPlan {
  name: string;
  price: number;
  features: string[];
  duration_days: number;
}

export interface SubscriptionPlanResponse {
  plan: SubscriptionPlan;
}

export interface SubscriptionCreate {
  plan: 'premium';
  payment_provider: 'stripe';
  payment_token: string;
  // User data included in subscription creation
  name: string;
  email: string;
  password: string;
}

export interface SubscriptionCreateForUser {
  plan: 'premium';
  payment_provider: 'stripe';
  payment_token: string;
}

export interface PaymentResponse {
  success: boolean;
  subscription_id?: string;
  message: string;
  payment_url?: string;
}

export interface PaymentConfig {
  stripe: {
    publishable_key: string;
  };
}

// Backend data structure interfaces
export interface BackendListing {
  _id: string; // UUID from database
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
  "Contact Number"?: string;
  "Reference URL"?: string;
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
  imageUrl: string; // primary image for card display
  images: string[]; // all available images for the listing
  yearBuilt?: string; // Changed to string since backend returns descriptive dates
  listingDate: string;
  description: string;
  features: string[];
  propertyType?: string;
  transportation?: string;
  buildingStructure?: string;
  contactNumber?: string;
  referenceUrl?: string;
}

export interface Favorite {
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface DeleteFavorite {
  user_id: string;
  listing_id: string;
}


export interface GetFavorites {
  favorites: string[];
}

// API client functions
export class RealEstateAPI {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Try to get token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('access_token', token);
      } else {
        localStorage.removeItem('access_token');
      }
    }
  }

  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if token exists
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      headers,
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          errorMessage = errorJson.detail;
        }
      } catch {
        // If can't parse as JSON, use the text
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Authentication methods
  async register(registerData: RegisterData): Promise<{ message: string; user_id: string }> {
    return this.fetchAPI<{ message: string; user_id: string }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerData),
    });
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // FastAPI OAuth2PasswordRequestForm expects form data, not JSON
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await fetch(`${this.baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Login failed: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          errorMessage = errorJson.detail;
        }
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const loginResponse = await response.json();
    
    // Set token for future requests
    this.setToken(loginResponse.access_token);
    
    return loginResponse;
  }

  async logout(): Promise<void> {
    try {
      await this.fetchAPI<any>('/v1/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      // Even if logout fails on server, clear local token
      console.warn('Logout request failed:', error);
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.fetchAPI<User>('/v1/auth/me');
  }

  async updateUserName(name: string): Promise<{ message: string; name: string }> {
    return this.fetchAPI<{ message: string; name: string }>('/v1/auth/update-name', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async updateUserPassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.fetchAPI<{ message: string }>('/v1/auth/update-password', {
      method: 'PUT',
      body: JSON.stringify({ 
        current_password: currentPassword,
        new_password: newPassword 
      }),
    });
  }

  async getSubscriptionPlan(): Promise<SubscriptionPlanResponse> {
    return this.fetchAPI<SubscriptionPlanResponse>('/v1/auth/subscription-plan');
  }

  async getPaymentConfig(): Promise<PaymentConfig> {
    return this.fetchAPI<PaymentConfig>('/v1/payments/config');
  }

  async checkEmail(email: string): Promise<{ exists: boolean; message: string }> {
    return this.fetchAPI<{ exists: boolean; message: string }>('/v1/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  // Payment methods - now creates both user and subscription
  async createSubscription(subscriptionData: SubscriptionCreate): Promise<PaymentResponse> {
    return this.fetchAPI<PaymentResponse>('/v1/payments/create-subscription', {
      method: 'POST',
      body: JSON.stringify(subscriptionData),
    });
  }

  async createSubscriptionForUser(subscriptionData: SubscriptionCreateForUser): Promise<PaymentResponse> {
    return this.fetchAPI<PaymentResponse>('/v1/payments/create-subscription-for-user', {
      method: 'POST',
      body: JSON.stringify(subscriptionData),
    });
  }

  async getUserSubscription(): Promise<any> {
    return this.fetchAPI<any>('/v1/payments/subscription');
  }

  async cancelSubscription(): Promise<any> {
    return this.fetchAPI<any>('/v1/payments/cancel-subscription', {
      method: 'POST',
    });
  }

  async renewSubscription(renewalData: {
    plan: 'premium';
    payment_provider: 'stripe';
    payment_token: string;
  }): Promise<PaymentResponse> {
    return this.fetchAPI<PaymentResponse>('/v1/payments/renew-subscription', {
      method: 'POST',
      body: JSON.stringify(renewalData),
    });
  }

  async reactivateSubscription(): Promise<PaymentResponse> {
    return this.fetchAPI<PaymentResponse>('/v1/payments/reactivate-subscription', {
      method: 'POST',
    });
  }

  // Existing listing methods
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

  // Helper function to transform backend data to frontend format
  transformBackendListing(backendListing: BackendListing, index: number): RealEstateListing {
    // Use the actual UUID from the database
    const id = backendListing._id;

    // Generate a title based on available data
    const title = backendListing["Property Type"] && backendListing["Property Location"] ?
      `${backendListing["Property Type"]} in ${backendListing["Property Location"]}` :
      `Property in ${backendListing.Prefecture}`;

    // Use the first image from the images array if available, otherwise use a default placeholder
    let imageUrl: string;
    let images: string[] = [];
    
    if (backendListing.images && backendListing.images.length > 0 && backendListing.images[0]) {
      // Process all images from the backend for the images array
      images = backendListing.images
        .filter(imagePath => imagePath && typeof imagePath === 'string')
        .map(imagePath => {
          const cleanPath = imagePath.replace(/^images\//, ''); // Remove "images/" prefix if present
          return `${API_BASE_URL}/images/${cleanPath}`;
        });
      
      // Use the first image as the primary imageUrl (same logic as before)
      const imagePath = backendListing.images[0];
      if (imagePath && typeof imagePath === 'string') {
        const cleanPath = imagePath.replace(/^images\//, ''); // Remove "images/" prefix if present
        imageUrl = `${API_BASE_URL}/images/${cleanPath}`;
      } else {
        // Use a simple placeholder if image path is invalid
        imageUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='Arial' font-size='16'%3ENo Image Available%3C/text%3E%3C/svg%3E";
        images = [imageUrl]; // Use placeholder for images array too
      }
    } else {
      // Use a simple placeholder if no images are available
      imageUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='Arial' font-size='16'%3ENo Image Available%3C/text%3E%3C/svg%3E";
      images = [imageUrl]; // Use placeholder for images array too
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
      images,
      yearBuilt: backendListing["Building - Construction Date"] ? 
        backendListing["Building - Construction Date"] : undefined,
      listingDate: backendListing.createdAt,
      description: `Beautiful property located in ${backendListing.Prefecture}. ${backendListing["Property Type"] ? `This ${backendListing["Property Type"].toLowerCase()} ` : ''}Perfect for modern living with great amenities.`,
      features: ["Modern amenities", "Great location", "Well maintained", "Good value"],
      propertyType: backendListing["Property Type"],
      transportation: backendListing.Transportation,
      buildingStructure: backendListing["Building - Structure"],
      contactNumber: backendListing["Contact Number"],
      referenceUrl: backendListing["Reference URL"]
    };
  }

  // Favorite methods
  async createFavorite(listing_id: string): Promise<Favorite> {
    return this.fetchAPI<Favorite>('/v1/favorites/favorites', {
      method: 'POST',
      body: JSON.stringify({ listing_id }),
    });
  }

  async deleteFavorite(listing_id: string): Promise<DeleteFavorite> {
    return this.fetchAPI<DeleteFavorite>(`/v1/favorites/favorites/${listing_id}`, {
      method: 'DELETE',
    });
  }

  async getFavorites(): Promise<GetFavorites> {
    return this.fetchAPI<GetFavorites>('/v1/favorites/favorites');
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
