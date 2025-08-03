import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RealEstateListing } from "@shared/real-estate";
import { realEstateAPI } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Heart, Phone, ExternalLink, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ListingDetailModal from "@/components/ListingDetailModal";
import { useToast } from "@/hooks/use-toast";

export default function Favorites() {
  const navigate = useNavigate();
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // State
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteListings, setFavoriteListings] = useState<RealEstateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedListing, setSelectedListing] = useState<RealEstateListing | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Copy link state
  const [copyingListingId, setCopyingListingId] = useState<string | null>(null);

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

  // Fetch user favorites
  const fetchFavorites = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await realEstateAPI.getFavorites();
      setFavorites(response.favorites);
      
      // Fetch the actual listing data for each favorite
      const listingsData: RealEstateListing[] = [];
      for (const favoriteId of response.favorites) {
        try {
          const backendListing = await realEstateAPI.getListingById(favoriteId);
          const transformedListing = realEstateAPI.transformBackendListing(backendListing, 0);
          // Use the original favoriteId instead of the transformed ID to ensure consistency
          transformedListing.id = favoriteId;
          listingsData.push(transformedListing);
        } catch (err) {
          console.error('Error fetching favorite listing:', err);
        }
      }
      
      setFavoriteListings(listingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch favorites');
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  // Remove favorite (on favorites page, we only remove)
  const removeFavorite = async (listingId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    
    if (!user) return;
    
    try {
      await realEstateAPI.deleteFavorite(listingId);
      setFavorites(prev => prev.filter(id => id !== listingId));
      setFavoriteListings(prev => prev.filter(listing => listing.id !== listingId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  // Copy link function
  const copyListingLink = async (listingId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    
    setCopyingListingId(listingId);
    
    try {
      const baseUrl = window.location.origin;
      const listingUrl = `${baseUrl}/listings?listing=${listingId}`;
      
      await navigator.clipboard.writeText(listingUrl);
      
      toast({
        title: "Link copied!",
        description: "The listing link has been copied to your clipboard.",
        duration: 3000,
      });
    } catch (err) {
      console.error('Error copying link:', err);
      toast({
        title: "Failed to copy link",
        description: "Please try again or copy the URL manually.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setCopyingListingId(null);
    }
  };



  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedListing(null);
  };

  // Fetch favorites when user changes
  useEffect(() => {
    if (user && hasActiveSubscription()) {
      fetchFavorites();
    } else {
      setLoading(false);
      setFavorites([]);
      setFavoriteListings([]);
    }
  }, [user, subscription]);

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-slate-600">Loading favorites...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-red-800 font-medium mb-2">Error loading favorites</div>
          <div className="text-red-600">{error}</div>
          <Button 
            onClick={fetchFavorites} 
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show subscription prompt if user doesn't have active subscription
  if (!hasActiveSubscription()) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Heart className="w-12 h-12 text-blue-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Premium Subscription Required
          </h1>
          
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Please sign up for a subscription to access your favorite listings. 
            Save and manage your favorite properties across Japan.
          </p>
          
          <Button 
            onClick={() => navigate('/subscription/manage')}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            Manage Subscription
          </Button>
        </div>
      </div>
    );
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

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Favorites</h1>
        <p className="text-gray-600">
          {favorites.length === 0 
            ? "You haven't added any favorites yet." 
            : `You have ${favorites.length} favorite listing${favorites.length === 1 ? '' : 's'}.`
          }
        </p>
      </div>

      {/* No favorites message */}
      {favorites.length === 0 && !loading && (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <div className="text-gray-500 text-lg mb-2">No favorites yet</div>
          <div className="text-gray-400 mb-6">Start browsing listings and add your favorites!</div>
          <Button onClick={() => navigate('/listings')}>
            Browse Listings
          </Button>
        </div>
      )}

      {/* Favorites Grid */}
      {favoriteListings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {favoriteListings.map((listing) => (
            <Card 
              key={listing.id} 
              className="group hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer"
              onClick={() => {
                setSelectedListing(listing);
                setIsModalOpen(true);
              }}
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
                  className="absolute bottom-3 right-3 bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1 text-sm font-semibold text-white flex items-center cursor-pointer transition-colors hover:bg-red-600"
                  onClick={(e) => removeFavorite(listing.id, e)}
                >
                  <Heart className="w-3 h-3 mr-1 fill-current" />
                  <span className="text-xs">Remove</span>
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
                  
                  {/* Copy Link Button */}
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center justify-center gap-2 text-xs"
                      onClick={(e) => copyListingLink(listing.id, e)}
                    >
                      <Copy className="w-3 h-3" />
                      {copyingListingId === listing.id ? 'Copying...' : 'Copy Link'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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