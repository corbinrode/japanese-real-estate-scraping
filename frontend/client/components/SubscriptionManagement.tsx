import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { realEstateAPI } from '@/shared/api';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  payment_provider: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

interface SubscriptionManagementProps {
  onSubscriptionExpired?: () => void;
}

export default function SubscriptionManagement({ onSubscriptionExpired }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await realEstateAPI.getUserSubscription();
      setSubscription(response.subscription);
    } catch (error: any) {
      console.error('Failed to fetch subscription:', error);
      setMessage({ type: 'error', text: 'Failed to load subscription information' });
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    setCancelling(true);
    try {
      await realEstateAPI.cancelSubscription();
      setMessage({ type: 'success', text: 'Subscription cancelled successfully' });
      await fetchSubscription(); // Refresh subscription data
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to cancel subscription' 
      });
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      case 'expired':
        return <Badge className="bg-yellow-100 text-yellow-800">Expired</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const isExpired = (subscription: Subscription) => {
    const endDate = new Date(subscription.ends_at);
    const isDateExpired = endDate < new Date();
    
    // Subscription is expired if:
    // 1. The end date has passed, OR
    // 2. Status is explicitly 'expired', OR  
    // 3. Status is 'inactive'
    return isDateExpired || 
           subscription.status === 'expired' || 
           subscription.status === 'inactive';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            No Subscription Found
          </CardTitle>
          <CardDescription>
            You don't have an active subscription. Please subscribe to access premium features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.href = '/register'}>
            Subscribe Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Subscription Details
          </CardTitle>
          <CardDescription>
            Manage your Japanese Real Estate Premium subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <div className="mt-1">
                {getStatusBadge(subscription.status)}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Plan</label>
              <div className="mt-1 capitalize">
                {subscription.plan} - $20/month
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Payment Method</label>
              <div className="mt-1 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="capitalize">{subscription.payment_provider}</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">
                {subscription.status === 'cancelled' ? 'Access Ends' : 'Next Billing Date'}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className={subscription.status === 'cancelled' ? 'text-red-600 font-medium' : ''}>
                  {format(new Date(subscription.ends_at), 'MMM dd, yyyy')}
                </span>
              </div>
            </div>
          </div>

          {/* Show different alerts based on subscription status */}
          {subscription.status === 'cancelled' && new Date(subscription.ends_at) > new Date() && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your subscription is cancelled and will end on{' '}
                <strong>{format(new Date(subscription.ends_at), 'MMM dd, yyyy')}</strong>.{' '}
                You'll lose access to premium features after this date unless you renew.
              </AlertDescription>
            </Alert>
          )}

          {isExpired(subscription) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your subscription has expired. Please renew to continue accessing premium features.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4 pt-4 border-t">
            {/* Active subscription - show cancel button */}
            {subscription.status === 'active' && !isExpired(subscription) && (
              <Button 
                variant="destructive" 
                onClick={cancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            )}
            
            {/* Cancelled but still active - show renewal option */}
            {subscription.status === 'cancelled' && new Date(subscription.ends_at) > new Date() && (
              <div className="flex gap-4">
                <Button 
                  onClick={() => window.location.href = '/subscription/renew'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Renew Before {format(new Date(subscription.ends_at), 'MMM dd')}
                </Button>
              </div>
            )}
            
            {/* Fully expired - show renewal option */}
            {isExpired(subscription) && (
              <Button 
                onClick={() => window.location.href = '/subscription/renew'}
                className="bg-green-600 hover:bg-green-700"
              >
                Renew Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription History</CardTitle>
          <CardDescription>
            Your subscription was created on {format(new Date(subscription.created_at), 'MMM dd, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            <p>• Monthly subscription: $20/month</p>
            <p>• Automatic renewal: {subscription.status === 'active' ? 'Enabled' : 'Disabled'}</p>
            {subscription.status === 'cancelled' && new Date(subscription.ends_at) > new Date() ? (
              <p className="text-orange-600 font-medium">• Will not renew - access ends {format(new Date(subscription.ends_at), 'MMM dd, yyyy')}</p>
            ) : (
              <p>• Can cancel anytime</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 