import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RealEstateListing, PREFECTURES, getPrefectureValue, getPrefectureDisplay } from "@shared/real-estate";
import { realEstateAPI } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Lock, CreditCard, Phone, ExternalLink, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ListingDetailModal from "@/components/ListingDetailModal";

type SortOption = "price-asc" | "price-desc" | "date-new" | "date-old";

export default function Listings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, subscription } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  const [filters, setFilters] = useState({
    prefecture: "",
    priceMin: "",
    priceMax: "", 
    floorPlan: ""
  });
  
  const [sortBy, setSortBy] = useState<SortOption>("date-new");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTrigger, setSearchTrigger] = useState(0); // Track when to search
  
  // API state
  const [listings, setListings] = useState<RealEstateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  
  // Modal state
  const [selectedListing, setSelectedListing] = useState<RealEstateListing | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  

  // Handle success message from navigation
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  // Check if user has active subscription
  const hasActiveSubscription = () => {
    // Admin users always have access
    if (user?.role === 'admin') {
      return true;
    }
    
    // Check if subscription is active and not expired
    if (!subscription) {
      return false;
    }
    
    const isActive = subscription.status === 'active' || 
                    (subscription.status === 'cancelled' && new Date(subscription.ends_at) > new Date());
    
    return isActive;
  };

  // Subscription prompt component
  const SubscriptionPrompt = () => (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <Lock className="w-12 h-12 text-blue-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Premium Subscription Required
        </h1>
        
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Please sign up for a subscription to access our premium Japanese real estate listings. 
          Get unlimited access to properties across Japan with detailed information and high-quality images.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 max-w-md mx-auto">
          <div className="flex items-center justify-center mb-4">
            <CreditCard className="w-6 h-6 text-blue-600 mr-2" />
            <span className="text-2xl font-bold text-blue-900">$20/month</span>
          </div>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              Access to all real estate listings
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              High-quality property images
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              Detailed property information
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              Cancel anytime
            </li>
          </ul>
        </div>
        
        <Button 
          onClick={() => navigate('/subscription/manage')}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
        >
          Manage Subscription
        </Button>
        
        <p className="text-sm text-gray-500 mt-4">
          Already have a subscription? Check your subscription status in your account settings.
        </p>
      </div>
    </div>
  );


  // Fetch listings from API
  const fetchListings = async () => {
    // Don't fetch if user doesn't have active subscription
    if (!hasActiveSubscription()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params: any = {
        page: currentPage,
        limit: itemsPerPage
      };

      // Add filters
      if (filters.prefecture) params.prefecture = getPrefectureValue(filters.prefecture);
      if (filters.floorPlan) params.layout = filters.floorPlan;
      if (filters.priceMin) params.sale_price_min = parseInt(filters.priceMin);
      if (filters.priceMax) params.sale_price_max = parseInt(filters.priceMax);

      // Add sorting
      if (sortBy === "price-asc") {
        params.sort_by = "sale_price";
        params.sort_order = "asc";
      } else if (sortBy === "price-desc") {
        params.sort_by = "sale_price";
        params.sort_order = "desc";
      } else if (sortBy === "date-new") {
        params.sort_by = "createdAt";
        params.sort_order = "desc";
      } else if (sortBy === "date-old") {
        params.sort_by = "createdAt";
        params.sort_order = "asc";
      }

      const response = await realEstateAPI.getListings(params);
      
      // Transform backend data to frontend format
      const transformedListings = response.results.map((backendListing, index) => 
        realEstateAPI.transformBackendListing(backendListing, index)
      );

      setListings(transformedListings);
      setTotalCount(response.total_count);
      setTotalPages(response.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch listings');
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch listings when sorting, pagination, search trigger changes, or subscription status changes
  useEffect(() => {
    if (hasActiveSubscription()) {
      fetchListings();
    } else {
      setLoading(false);
      setListings([]);
      setTotalCount(0);
      setTotalPages(0);
    }
  }, [sortBy, currentPage, itemsPerPage, searchTrigger, user, subscription]);

  // Fetch favorites when user changes
  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
    }
  }, [user]);

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const clearFilters = () => {
    setFilters({
      prefecture: "",
      priceMin: "",
      priceMax: "",
      floorPlan: ""
    });
    setCurrentPage(1);
    setSearchTrigger(prev => prev + 1);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setSearchTrigger(prev => prev + 1);
  };

  const handleListingClick = (listing: RealEstateListing) => {
    setSelectedListing(listing);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedListing(null);
  };

  // Fetch user favorites
  const fetchFavorites = async () => {
    if (!user) return;
    
    setFavoritesLoading(true);
    try {
      const response = await realEstateAPI.getFavorites();
      setFavorites(response.favorites);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setFavoritesLoading(false);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (listingId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    
    if (!user) return;
    
    try {
      if (favorites.includes(listingId)) {
        // Remove from favorites
        await realEstateAPI.deleteFavorite(listingId);
        setFavorites(prev => prev.filter(id => id !== listingId));
      } else {
        // Add to favorites
        await realEstateAPI.createFavorite(listingId);
        setFavorites(prev => [...prev, listingId]);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Check if a listing is favorited
  const isFavorited = (listingId: string) => {
    return favorites.includes(listingId);
  };

  if (loading && listings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-slate-600">Loading listings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-red-800 font-medium mb-2">Error loading listings</div>
          <div className="text-red-600">{error}</div>
          <Button 
            onClick={fetchListings} 
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const startIndex = (currentPage - 1) * itemsPerPage;

  // Show subscription prompt if user doesn't have active subscription
  if (!hasActiveSubscription()) {
    return <SubscriptionPrompt />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Success Message */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 mb-6">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
          {/* Prefecture Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Prefecture</label>
            <div className="flex gap-2">
              <Select value={filters.prefecture} onValueChange={(value) => {
                setFilters(prev => ({ ...prev, prefecture: value }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Any prefecture" />
                </SelectTrigger>
                <SelectContent>
                  {PREFECTURES.map(pref => (
                    <SelectItem key={pref.value} value={pref.display}>{pref.display}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.prefecture && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setFilters(prev => ({ ...prev, prefecture: "" }));
                    setCurrentPage(1);
                    setSearchTrigger(prev => prev + 1);
                  }}
                  className="px-2"
                >
                  ✕
                </Button>
              )}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Min Price ($)</label>
            <Input
              type="number"
              placeholder="Min price"
              value={filters.priceMin}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, priceMin: e.target.value }));
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Max Price ($)</label>
            <Input
              type="number"
              placeholder="Max price"
              value={filters.priceMax}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, priceMax: e.target.value }));
              }}
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
            <Select value={sortBy} onValueChange={(value) => {
              setSortBy(value as SortOption);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-new">Newest First</SelectItem>
                <SelectItem value="date-old">Oldest First</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Items Per Page */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Show</label>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => {
              setItemsPerPage(parseInt(value));
              setCurrentPage(1);
              setSearchTrigger(prev => prev + 1);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="40">40 per page</SelectItem>
                <SelectItem value="60">60 per page</SelectItem>
                <SelectItem value="80">80 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearFilters}>
              Clear All Filters
            </Button>
            <Button onClick={handleSearch}>
              Search
            </Button>
          </div>
          <div className="text-sm text-slate-600 text-center sm:text-right">
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalCount)} of {totalCount} results
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-slate-600">Loading...</div>
        </div>
      )}

      {/* Listings Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {listings.map((listing) => (
            <Card 
              key={listing.id} 
              className="group hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer"
              onClick={() => handleListingClick(listing)}
            >
              <div className="relative">
                <img 
                  src={listing.imageUrl} 
                  alt={listing.title}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute bottom-3 left-3 flex gap-2">
                  {listing.images.length > 1 && (
                    <div className="bg-black/70 text-white px-2 py-1 rounded text-xs">
                      {listing.images.length} photos
                    </div>
                  )}
                  {listing.contactNumber && (
                    <div className="bg-green-600/90 text-white px-2 py-1 rounded text-xs flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      Contact
                    </div>
                  )}
                </div>
                {listing.floorPlan && (
                  <div className="absolute top-3 left-3 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    {listing.floorPlan}
                  </div>
                )}
                {listing.price !== undefined && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-sm font-semibold text-slate-900">
                    {formatPrice(listing.price)}
                  </div>
                )}
                <div 
                  className={`absolute bottom-3 right-3 backdrop-blur-sm rounded-full px-2 py-1 text-sm font-semibold flex items-center cursor-pointer transition-colors ${
                    isFavorited(listing.id) 
                      ? 'bg-red-500/90 text-white' 
                      : 'bg-white/90 text-slate-900 hover:bg-red-50'
                  }`}
                  onClick={(e) => toggleFavorite(listing.id, e)}
                >
                  <Heart className={`w-3 h-3 mr-1 ${isFavorited(listing.id) ? 'fill-current' : ''}`} />
                  <span className="text-xs">
                    {isFavorited(listing.id) ? 'Favorited' : 'Add to Favorites'}
                  </span>
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  {listing.floorPlan && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Floor Plan:</span>
                      <span className="font-medium">{listing.floorPlan}</span>
                    </div>
                  )}
                  
                  {listing.area && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Area:</span>
                      <span className="font-medium">{listing.area}</span>
                    </div>
                  )}
                  
                  {listing.landArea && listing.landArea !== "0" && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Land Area:</span>
                      <span className="font-medium">{listing.landArea}</span>
                    </div>
                  )}
                  
                  {listing.yearBuilt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Construction Date:</span>
                      <span className="font-medium">{listing.yearBuilt}</span>
                    </div>
                  )}
                  
                  {listing.buildingStructure && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Building Structure:</span>
                      <span className="font-medium">{listing.buildingStructure}</span>
                    </div>
                  )}
                  
                  {listing.price !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Price:</span>
                      <span className="font-medium text-blue-600">{formatPrice(listing.price)}</span>
                    </div>
                  )}
                  
                  {listing.propertyType && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Property Type:</span>
                      <span className="font-medium">{listing.propertyType}</span>
                    </div>
                  )}
                  
                  {listing.address && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location:</span>
                      <span className="font-medium">{listing.address}</span>
                    </div>
                  )}

                  {/* Contact Information */}
                  {listing.contactNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contact:</span>
                      <a 
                        href={`tel:${listing.contactNumber}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {listing.contactNumber}
                      </a>
                    </div>
                  )}

                  {listing.referenceUrl && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reference:</span>
                      <a 
                        href={listing.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-800 flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        URL
                      </a>
                    </div>
                  )}
                  
                  {listing.transportation && (
                    <div className="pt-2 border-t">
                      <div className="text-slate-500 mb-1">Transportation:</div>
                      <div className="text-xs text-slate-600 space-y-1">
                        {listing.transportation.split(/\s*\/\s*/).map((line, index) => (
                          <div key={index}>{line.trim()}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No results message */}
      {!loading && listings.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-500 text-lg">No listings found</div>
          <div className="text-slate-400 mt-2">Try adjusting your filters</div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          {/* Mobile-friendly pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage(1)}
              >
                First
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Prev
              </Button>
            </div>
            
            {/* Page numbers */}
            <div className="flex flex-wrap justify-center gap-1 max-w-xs sm:max-w-none">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    disabled={loading}
                    onClick={() => setCurrentPage(pageNum)}
                    className="min-w-[2.5rem]"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={currentPage === totalPages || loading}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                disabled={currentPage === totalPages || loading}
                onClick={() => setCurrentPage(totalPages)}
              >
                Last
              </Button>
            </div>
          </div>
          
          {/* Page info */}
          <div className="text-center text-sm text-slate-600 mt-3">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}

      {/* Listing Detail Modal */}
      <ListingDetailModal
        listing={selectedListing}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}

