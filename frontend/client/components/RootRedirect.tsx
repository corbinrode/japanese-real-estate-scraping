import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function RootRedirect() {
  const { isAuthenticated, user, subscription, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return; // Wait for auth to load

    if (!isAuthenticated) {
      // Not authenticated -> go to login
      navigate("/login", { replace: true });
      return;
    }

    // Admin users can bypass subscription requirement and go directly to listings
    if (user && user.role === 'admin') {
      navigate("/listings", { replace: true });
      return;
    }

    // User is authenticated, check subscription
    const hasValidSubscription = subscription && 
      (subscription.status === 'active' || subscription.status === 'cancelled') && 
      new Date(subscription.ends_at) > new Date();

    if (hasValidSubscription) {
      // Has valid subscription (active or cancelled but not expired) -> go to listings
      navigate("/listings", { replace: true });
    } else {
      // Check if user has existing subscription (expired/cancelled) vs new user
      const hasExistingSubscription = subscription && (
        subscription.status === 'cancelled' || 
        subscription.status === 'expired' ||
        subscription.status === 'inactive' ||
        new Date(subscription.ends_at) <= new Date()
      );

      if (hasExistingSubscription) {
        // Existing user needs to renew
        navigate("/subscription/renew", { replace: true });
      } else {
        // New user needs to register
        navigate("/register", { replace: true });
      }
    }
  }, [isAuthenticated, user, subscription, loading, navigate]);

  // Show loading while determining where to redirect
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // This component doesn't render anything, it just redirects
  return null;
} 