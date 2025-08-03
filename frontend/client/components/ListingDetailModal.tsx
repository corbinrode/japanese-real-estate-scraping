import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Phone, ExternalLink } from "lucide-react";
import { RealEstateListing } from "@shared/real-estate";

interface ListingDetailModalProps {
  listing: RealEstateListing | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ListingDetailModal({ listing, isOpen, onClose }: ListingDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!listing) {
    return null;
  }

  console.log('Modal: Rendering with listing:', listing.title, 'isOpen:', isOpen);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % listing.images.length);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + listing.images.length) % listing.images.length);
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  // Reset image index when modal opens with a new listing
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setCurrentImageIndex(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 pb-2">
          <DialogTitle className="text-lg font-semibold text-gray-800">
            📍 {listing.address ? `${listing.address}` : listing.prefecture}
          </DialogTitle>
        </DialogHeader>

        {/* Main Content Area - Controlled Height */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Navigation and Image Container - Takes available space minus thumbnail area */}
          <div className="flex-1 flex items-center bg-black min-h-0">
            {/* Left Arrow - Outside Image */}
            {listing.images.length > 1 && (
              <div className="flex items-center justify-center w-16 h-full">
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white/90 hover:bg-white"
                  onClick={previousImage}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Main Image - Fixed Size Container */}
            <div className="flex-1 relative h-full flex items-center justify-center">
              {listing.images && listing.images.length > 0 ? (
                <>
                  <img
                    src={listing.images[currentImageIndex]}
                    alt={`${listing.title} - Image ${currentImageIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                  
                  {/* Image Counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {listing.images.length}
                  </div>
                </>
              ) : (
                <div className="text-white text-center">
                  <div className="text-lg mb-2">No Images Available</div>
                  <div className="text-sm text-gray-300">This listing does not have any images</div>
                </div>
              )}
            </div>

            {/* Right Arrow - Outside Image */}
            {listing.images.length > 1 && (
              <div className="flex items-center justify-center w-16 h-full">
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white/90 hover:bg-white"
                  onClick={nextImage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Thumbnail Strip at Bottom - Always Visible */}
          {listing.images.length > 1 && (
            <div className="flex-shrink-0 p-4 bg-gray-100 border-t">
              <div className={`flex gap-2 overflow-x-auto overflow-y-hidden ${
                listing.images.length <= 6 ? 'justify-center' : 'justify-start'
              }`}>
                {listing.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => goToImage(index)}
                    className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                      index === currentImageIndex
                        ? 'border-blue-500 scale-105'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 