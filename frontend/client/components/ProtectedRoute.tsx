import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireSubscription?: boolean;
}

export default function ProtectedRoute({ children, requireSubscription = false }: ProtectedRouteProps) {
  const { isAuthenticated, user, subscription, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
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

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check subscription requirement
  if (requireSubscription) {
    // Admin users can bypass subscription requirement
    if (user.role === 'admin') {
      return <>{children}</>;
    }

    const hasValidSubscription = subscription && 
      (subscription.status === 'active' || subscription.status === 'cancelled') && 
      new Date(subscription.ends_at) > new Date();

    if (!hasValidSubscription) {
      // Check if user has ever had a subscription (renewal case) vs first time (registration case)
      const hasExistingSubscription = subscription && (
        subscription.status === 'cancelled' || 
        subscription.status === 'expired' ||
        subscription.status === 'inactive' ||
        new Date(subscription.ends_at) <= new Date()
      );

      if (hasExistingSubscription) {
        // Redirect to renewal page for existing subscribers
        return <Navigate to="/subscription/renew" state={{ from: location }} replace />;
      } else {
        // Show subscription required message for new users
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Required</h2>
                <p className="text-gray-600">
                  You need an active subscription to access premium real estate listings.
                </p>
              </div>
              <div className="space-y-3">
                <a 
                  href="/register" 
                  className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Subscribe Now - $20/month
                </a>
                <p className="text-xs text-gray-500">
                  Get access to all premium Japanese real estate listings
                </p>
              </div>
            </div>
          </div>
        );
      }
    }
  }

  return <>{children}</>;
} 