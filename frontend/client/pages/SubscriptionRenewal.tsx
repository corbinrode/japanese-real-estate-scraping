import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';
import StripePayment from '@/components/StripePayment';
import { realEstateAPI } from '@/shared/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PLAN_PRICE = 20;

let stripePromise: Promise<any> | null = null;

export default function SubscriptionRenewal() {
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPaymentConfig();
  }, []);

  const fetchPaymentConfig = async () => {
    try {
      const response = await realEstateAPI.getPaymentConfig();
      setPaymentConfig(response);
      
      if (response?.stripe?.publishable_key) {
        stripePromise = loadStripe(response.stripe.publishable_key);
      }
    } catch (error) {
      console.error('Failed to fetch payment config:', error);
      setMessage({ type: 'error', text: 'Failed to load payment configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleStripePayment = async (paymentMethodId: string) => {
    setProcessing(true);
    try {
      const response = await realEstateAPI.renewSubscription({
        plan: 'premium',
        payment_provider: 'stripe',
        payment_token: paymentMethodId
      });

      setMessage({ type: 'success', text: response.message });
      await refreshUser(); // Refresh user data with new subscription
      
      // Redirect to listings after successful payment
      setTimeout(() => {
        navigate('/listings');
      }, 2000);
      
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Payment failed' 
      });
    } finally {
      setProcessing(false);
    }
  };



  const handlePaymentError = (error: string) => {
    setMessage({ type: 'error', text: error });
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Renew Your Subscription
          </h1>
          <p className="text-gray-600">
            Your subscription has expired. Please renew to continue accessing premium real estate listings.
          </p>
        </div>

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className="mb-6">
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Premium Plan - $20/month
            </CardTitle>
            <CardDescription>
              Renew your monthly subscription to access all premium features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">What's included:</h3>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Access to all real estate listings</li>
                  <li>• Monthly automatic renewal</li>
                  <li>• Cancel anytime</li>
                  <li>• Premium customer support</li>
                </ul>
              </div>
            </div>

            {paymentConfig?.stripe && stripePromise ? (
              <Elements stripe={stripePromise}>
                <StripePayment
                  onPaymentSuccess={handleStripePayment}
                  onPaymentError={handlePaymentError}
                  isProcessing={processing}
                  amount={PLAN_PRICE}
                />
              </Elements>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  Stripe payment is not configured. Please contact support.
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-6 pt-6 border-t text-center">
              <p className="text-sm text-gray-500">
                By renewing, you agree to our Terms of Service and Privacy Policy.
                Your subscription will automatically renew monthly until cancelled.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 