import React, { useState, useEffect } from "react";
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Check, CreditCard, Loader2, AlertCircle } from "lucide-react";
import { realEstateAPI, SubscriptionPlan, PaymentConfig } from "@/shared/api";
import StripePayment from "@/components/StripePayment";
import { useAuth } from "@/contexts/AuthContext";

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [errors, setErrors] = useState<{ general?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [isRenewal, setIsRenewal] = useState(false);

  // Load subscription plan, payment config, and current subscription
  useEffect(() => {
    const loadData = async () => {
      try {
        const [planResponse, configResponse, subscriptionResponse] = await Promise.all([
          realEstateAPI.getSubscriptionPlan(),
          realEstateAPI.getPaymentConfig(),
          realEstateAPI.getUserSubscription()
        ]);
        
        setSubscriptionPlan(planResponse.plan);
        setPaymentConfig(configResponse);
        setCurrentSubscription(subscriptionResponse.subscription);
        
        // Determine if this is a renewal or new subscription
        if (subscriptionResponse.subscription) {
          const subscription = subscriptionResponse.subscription;
          const endsAt = new Date(subscription.ends_at);
          const now = new Date();
          
          if (subscription.status === 'active' && endsAt > now) {
            // User has active subscription, redirect to listings
            navigate('/listings');
            return;
          } else {
            // User has expired/cancelled subscription
            setIsRenewal(true);
          }
        }
        
        // Initialize Stripe if we have the key
        if (configResponse.stripe.publishable_key) {
          setStripePromise(loadStripe(configResponse.stripe.publishable_key));
        }
      } catch (error) {
        console.error('Failed to load subscription data:', error);
        setErrors({ general: 'Failed to load payment options. Please refresh and try again.' });
      }
    };
    
    if (user) {
      loadData();
    }
  }, [user, navigate]);

  const handleStripePaymentSuccess = async (paymentMethodId: string) => {
    await createSubscription(paymentMethodId);
  };

  const handlePaymentError = (error: string) => {
    setErrors({ general: error });
    setSubmitting(false);
  };

  const createSubscription = async (paymentToken: string) => {
    setSubmitting(true);
    setErrors({});

    try {
      let response;
      
      if (isRenewal) {
        // Use renewal endpoint
        response = await realEstateAPI.renewSubscription({
          plan: 'premium',
          payment_provider: 'stripe',
          payment_token: paymentToken
        });
      } else {
        // Use new subscription endpoint for existing users
        response = await realEstateAPI.createSubscriptionForUser({
          plan: 'premium',
          payment_provider: 'stripe',
          payment_token: paymentToken
        });
      }

      if (response.success) {
        // Refresh user context to include new subscription data
        await refreshUser();
        
        // Successful payment, redirect to listings
        navigate('/listings', { 
          state: { message: `Subscription ${isRenewal ? 'renewed' : 'activated'} successfully!` }
        });
      } else {
        setErrors({ general: response.message || 'Subscription creation failed' });
      }
    } catch (error) {
      console.error('Subscription creation error:', error);
      setErrors({ 
        general: error instanceof Error ? error.message : 'Subscription creation failed' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Redirect to login if not authenticated
  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle>
            {isRenewal ? 'Renew Your Subscription' : 'Subscribe to Premium'}
          </CardTitle>
          <CardDescription>
            {isRenewal 
              ? 'Your subscription has expired. Renew to continue accessing premium listings.'
              : 'Subscribe to access premium Japanese real estate listings'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {errors.general && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.general}</AlertDescription>
              </Alert>
            )}

            {/* Current Subscription Status */}
            {currentSubscription && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700">
                  Your subscription {currentSubscription.status === 'cancelled' ? 'was cancelled' : 'expired'} on{' '}
                  {new Date(currentSubscription.ends_at).toLocaleDateString()}
                </AlertDescription>
              </Alert>
            )}

            {/* Subscription Plan Display */}
            {subscriptionPlan && (
              <div className="border rounded-lg p-6 bg-blue-50 border-blue-200">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-blue-900 mb-2">
                    ${subscriptionPlan.price}<span className="text-lg font-normal">/month</span>
                  </div>
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-600 text-white mb-4">
                    Premium Access
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  {subscriptionPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="w-4 h-4 text-green-600 mr-3 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Payment Form */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <Label className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Credit Card Payment
                </Label>
              </div>
              {stripePromise && paymentConfig && (
                <Elements stripe={stripePromise}>
                  <StripePayment
                    onPaymentSuccess={handleStripePaymentSuccess}
                    onPaymentError={handlePaymentError}
                    isProcessing={submitting}
                    amount={subscriptionPlan?.price || 20}
                  />
                </Elements>
              )}

              {!paymentConfig && (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading payment options...</span>
                </div>
              )}
            </div>

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/listings')}
                className="flex-1"
                disabled={submitting}
              >
                Back to Listings
              </Button>
            </div>

            <p className="text-xs text-center text-slate-500">
              By subscribing, you agree to our terms of service and privacy policy.
              Your subscription will be activated immediately upon successful payment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 