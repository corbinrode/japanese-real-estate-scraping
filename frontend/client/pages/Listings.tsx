import { useState, useMemo, useEffect } from "react";
import { RealEstateListing, PREFECTURES, getPrefectureValue, getPrefectureDisplay } from "@shared/real-estate";
import { realEstateAPI } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type SortOption = "price-asc" | "price-desc" | "date-new" | "date-old";

export default function Listings() {
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
  
  // Unique layouts state
  const [uniqueLayouts, setUniqueLayouts] = useState<string[]>([]);
  const [layoutsLoading, setLayoutsLoading] = useState(true);

  // Fetch unique layouts from API
  const fetchUniqueLayouts = async () => {
    try {
      setLayoutsLoading(true);
      const response = await realEstateAPI.getUniqueLayouts();
      setUniqueLayouts(response.unique_layouts);
    } catch (err) {
      console.error('Error fetching unique layouts:', err);
      // Fallback to empty array if API fails
      setUniqueLayouts([]);
    } finally {
      setLayoutsLoading(false);
    }
  };

  // Fetch unique layouts on component mount
  useEffect(() => {
    fetchUniqueLayouts();
  }, []);

  // Fetch listings from API
  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      
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

  // Fetch listings when sorting, pagination, or search trigger changes
  useEffect(() => {
    fetchListings();
  }, [sortBy, currentPage, itemsPerPage, searchTrigger]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
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

          {/* Floor Plan Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Floor Plan</label>
            <div className="flex gap-2">
              <Select value={filters.floorPlan} onValueChange={(value) => {
                setFilters(prev => ({ ...prev, floorPlan: value }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Any layout" />
                </SelectTrigger>
                <SelectContent>
                  {layoutsLoading ? (
                    <SelectItem value="" disabled>Loading layouts...</SelectItem>
                  ) : uniqueLayouts.length === 0 ? (
                    <SelectItem value="" disabled>No layouts found</SelectItem>
                  ) : (
                    uniqueLayouts.map(plan => (
                      <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {filters.floorPlan && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setFilters(prev => ({ ...prev, floorPlan: "" }));
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
            <Card key={listing.id} className="group hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <div className="relative">
                <img 
                  src={listing.imageUrl} 
                  alt={listing.title}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
                />
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
        <div className="flex items-center justify-center space-x-2 bg-white rounded-lg shadow-sm border p-4">
          <Button 
            variant="outline" 
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage(1)}
          >
            First
          </Button>
          
          <Button 
            variant="outline" 
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            Previous
          </Button>
          
          <div className="flex space-x-1">
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
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button 
            variant="outline" 
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            Next
          </Button>
          
          <Button 
            variant="outline" 
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage(totalPages)}
          >
            Last
          </Button>
        </div>
      )}
    </div>
  );
}

