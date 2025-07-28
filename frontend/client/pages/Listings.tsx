import { useState, useMemo } from "react";
import { allListings, RealEstateListing, PREFECTURES, FLOOR_PLANS } from "@shared/real-estate";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  const filteredAndSortedListings = useMemo(() => {
    let filtered = allListings.filter(listing => {
      if (filters.prefecture && listing.prefecture !== filters.prefecture) return false;
      if (filters.priceMin && listing.price && listing.price < parseInt(filters.priceMin)) return false;
      if (filters.priceMax && listing.price && listing.price > parseInt(filters.priceMax)) return false;
      if (filters.floorPlan && listing.floorPlan !== filters.floorPlan) return false;
      return true;
    });

    // Sort listings
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return (a.price || 0) - (b.price || 0);
        case "price-desc":
          return (b.price || 0) - (a.price || 0);
        case "date-new":
          return new Date(b.listingDate).getTime() - new Date(a.listingDate).getTime();
        case "date-old":
          return new Date(a.listingDate).getTime() - new Date(b.listingDate).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [filters, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedListings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentListings = filteredAndSortedListings.slice(startIndex, startIndex + itemsPerPage);

  const formatPrice = (price: number) => {
    return `¥${price.toLocaleString()}`;
  };

  const clearFilters = () => {
    setFilters({
      prefecture: "",
      priceMin: "",
      priceMax: "",
      floorPlan: ""
    });
    setCurrentPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
          {/* Prefecture Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Prefecture</label>
            <Select value={filters.prefecture} onValueChange={(value) => {
              setFilters(prev => ({ ...prev, prefecture: value }));
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Any prefecture" />
              </SelectTrigger>
              <SelectContent>
                {PREFECTURES.map(pref => (
                  <SelectItem key={pref} value={pref}>{pref}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Min Price (¥)</label>
            <Input
              type="number"
              placeholder="Min price"
              value={filters.priceMin}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, priceMin: e.target.value }));
                setCurrentPage(1);
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Max Price (¥)</label>
            <Input
              type="number"
              placeholder="Max price"
              value={filters.priceMax}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, priceMax: e.target.value }));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Floor Plan Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Floor Plan</label>
            <Select value={filters.floorPlan} onValueChange={(value) => {
              setFilters(prev => ({ ...prev, floorPlan: value }));
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Any layout" />
              </SelectTrigger>
              <SelectContent>
                {FLOOR_PLANS.map(plan => (
                  <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
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

        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedListings.length)} of {filteredAndSortedListings.length} results
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {currentListings.map((listing) => (
          <Card key={listing.id} className="group hover:shadow-lg transition-shadow duration-200 overflow-hidden">
            <div className="relative">
              <img 
                src={listing.imageUrl} 
                alt={listing.title}
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
              />
              {listing.floorPlan && (
                <Badge className="absolute top-3 left-3 bg-blue-600 hover:bg-blue-700">
                  {listing.floorPlan}
                </Badge>
              )}
              {listing.price && (
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
                    <span className="font-medium">{listing.area}m²</span>
                  </div>
                )}
                
                {listing.landArea && listing.landArea > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Land Area:</span>
                    <span className="font-medium">{listing.landArea}m²</span>
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
                
                {listing.price && (
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
                      {listing.transportation.split(' / ').map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 bg-white rounded-lg shadow-sm border p-4">
          <Button 
            variant="outline" 
            disabled={currentPage === 1}
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
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button 
            variant="outline" 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
