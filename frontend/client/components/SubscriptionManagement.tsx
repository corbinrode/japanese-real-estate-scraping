import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, AlertCircle, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { realEstateAPI } from '@/shared/api';
import StripePayment from '@/components/StripePayment';
import { useAuth } from '@/contexts/AuthContext';

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
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Payment-related state
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { refreshUser } = useAuth();

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

  const loadPaymentConfig = async () => {
    try {
      const [planResponse, configResponse] = await Promise.all([
        realEstateAPI.getSubscriptionPlan(),
        realEstateAPI.getPaymentConfig()
      ]);
      
      setPaymentConfig(configResponse);
      
      // Initialize Stripe if we have the key
      if (configResponse.stripe.publishable_key) {
        setStripePromise(loadStripe(configResponse.stripe.publishable_key));
      }
    } catch (error) {
      console.error('Failed to load payment config:', error);
      setMessage({ type: 'error', text: 'Failed to load payment options. Please refresh and try again.' });
    }
  };

  const cancelSubscription = async () => {
    setCancelling(true);
    try {
      await realEstateAPI.cancelSubscription();
      setMessage({ type: 'success', text: 'Subscription cancelled successfully' });
      await fetchSubscription(); // Refresh subscription data
      await refreshUser(); // Refresh auth context
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to cancel subscription' 
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleStripePaymentSuccess = async (paymentMethodId: string) => {
    await createSubscription(paymentMethodId);
  };

  const handlePaymentError = (error: string) => {
    setMessage({ type: 'error', text: error });
    setProcessing(false);
  };

  const createSubscription = async (paymentToken: string) => {
    setProcessing(true);
    setMessage(null);

    try {
      let response;
      
      if (subscription && ((subscription.status === 'cancelled' && !canReactivate(subscription)) || isExpired(subscription))) {
        // Use renewal endpoint for cancelled subscriptions that can't be reactivated or expired subscriptions
        response = await realEstateAPI.renewSubscription({
          plan: 'premium',
          payment_provider: 'stripe',
          payment_token: paymentToken
        });
      } else {
        // Use new subscription endpoint for first-time subscribers
        response = await realEstateAPI.createSubscriptionForUser({
          plan: 'premium',
          payment_provider: 'stripe',
          payment_token: paymentToken
        });
      }

      if (response.success) {
        setMessage({ type: 'success', text: response.message || 'Subscription activated successfully!' });
        setShowPaymentForm(false);
        await fetchSubscription(); // Refresh subscription data
        await refreshUser(); // Refresh auth context
      } else {
        setMessage({ type: 'error', text: response.message || 'Subscription creation failed' });
      }
    } catch (error: any) {
      console.error('Subscription creation error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Subscription creation failed' 
      });
    } finally {
      setProcessing(false);
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
    // Assume backend date is in UTC and append 'Z' if not present
    const endsAtUTC = subscription.ends_at.endsWith('Z') || subscription.ends_at.includes('+') 
      ? subscription.ends_at 
      : subscription.ends_at + 'Z';
    
    const endDate = new Date(endsAtUTC);
    const currentTime = new Date();
    const isDateExpired = endDate <= currentTime;
    
    // Debug logging
    console.log('Subscription expiration check:', {
      ends_at: subscription.ends_at,
      endsAtUTC,
      endDate: endDate.toISOString(),
      currentTime: currentTime.toISOString(),
      endTimestamp: endDate.getTime(),
      currentTimestamp: currentTime.getTime(),
      isDateExpired,
      status: subscription.status
    });
    
    // Subscription is expired if:
    // 1. The end date has passed, OR
    // 2. Status is explicitly 'expired', OR  
    // 3. Status is 'inactive'
    return isDateExpired || 
           subscription.status === 'expired' || 
           subscription.status === 'inactive';
  };

  const canReactivate = (subscription: Subscription) => {
    // Can reactivate if subscription is cancelled but still within active period
    return subscription.status === 'cancelled' && !isExpired(subscription);
  };

  const reactivateSubscription = async () => {
    setProcessing(true);
    setMessage(null);

    try {
      const response = await realEstateAPI.reactivateSubscription();
      
      if (response.success) {
        setMessage({ type: 'success', text: response.message || 'Subscription reactivated successfully!' });
        await fetchSubscription(); // Refresh subscription data
        await refreshUser(); // Refresh auth context
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to reactivate subscription' });
      }
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to reactivate subscription. Please try again.' 
      });
    } finally {
      setProcessing(false);
    }
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
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-blue-900 mb-2">
                  $20<span className="text-lg font-normal">/month</span>
                </div>
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-600 text-white mb-4">
                  Premium Access
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-3 flex-shrink-0" />
                  <span>Access to all real estate listings</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-3 flex-shrink-0" />
                  <span>High-quality property images</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-3 flex-shrink-0" />
                  <span>Detailed property information</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-3 flex-shrink-0" />
                  <span>Cancel anytime</span>
                </li>
              </ul>
            </div>
            
            <Button 
              onClick={async () => {
                await loadPaymentConfig();
                setShowPaymentForm(true);
              }}
              className="w-full"
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Subscribe Now - $20/month'
              )}
            </Button>
            
            {/* Payment Form */}
            {showPaymentForm && (
              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Complete Your Subscription</h3>
                {stripePromise && paymentConfig ? (
                  <Elements stripe={stripePromise}>
                    <StripePayment
                      onPaymentSuccess={handleStripePaymentSuccess}
                      onPaymentError={handlePaymentError}
                      isProcessing={processing}
                      amount={20}
                    />
                  </Elements>
                ) : (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Loading payment options...</span>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => setShowPaymentForm(false)}
                  className="mt-4 w-full"
                  disabled={processing}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
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
          {subscription.status === 'cancelled' && new Date(subscription.ends_at).getTime() > Date.now() && (
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
            
            {/* Cancelled but not expired - show simple reactivate button */}
            {canReactivate(subscription) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                  <span className="font-medium text-orange-800">Subscription Cancelled</span>
                </div>
                <p className="text-orange-700 mb-4">
                  Your subscription is cancelled but you still have access until {format(new Date(subscription.ends_at), 'MMM dd, yyyy')}. 
                  You can reactivate it without entering payment details again.
                </p>
                <Button 
                  onClick={reactivateSubscription}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Reactivate Subscription'
                  )}
                </Button>
              </div>
            )}

            {/* Cancelled and within renewal period - show renewal with payment */}
            {subscription.status === 'cancelled' && !canReactivate(subscription) && !isExpired(subscription) && (
              <Button 
                onClick={async () => {
                  await loadPaymentConfig();
                  setShowPaymentForm(true);
                }}
                className="bg-green-600 hover:bg-green-700"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Renew Before ${format(new Date(subscription.ends_at), 'MMM dd')}`
                )}
              </Button>
            )}
            
            {/* Fully expired - show renewal option */}
            {isExpired(subscription) && (
              <Button 
                onClick={async () => {
                  await loadPaymentConfig();
                  setShowPaymentForm(true);
                }}
                className="bg-green-600 hover:bg-green-700"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Renew Subscription'
                )}
              </Button>
            )}
          </div>
          
          {/* Payment Form for renewals */}
          {showPaymentForm && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-medium mb-4">
                {subscription && (subscription.status === 'cancelled' || isExpired(subscription)) 
                  ? 'Renew Your Subscription' 
                  : 'Complete Your Subscription'}
              </h3>
              {stripePromise && paymentConfig ? (
                <Elements stripe={stripePromise}>
                  <StripePayment
                    onPaymentSuccess={handleStripePaymentSuccess}
                    onPaymentError={handlePaymentError}
                    isProcessing={processing}
                    amount={20}
                  />
                </Elements>
              ) : (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading payment options...</span>
                </div>
              )}
              
              <Button 
                variant="outline" 
                onClick={() => setShowPaymentForm(false)}
                className="mt-4 w-full"
                disabled={processing}
              >
                Cancel
              </Button>
            </div>
          )}
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
            {subscription.status === 'cancelled' && new Date(subscription.ends_at).getTime() > Date.now() ? (
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