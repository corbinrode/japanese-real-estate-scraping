import React, { useState, useEffect } from "react";
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Loader2 } from "lucide-react";
import { realEstateAPI, SubscriptionPlan, PaymentConfig } from "@/shared/api";
import StripePayment from "@/components/StripePayment";

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function Register() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState<'register' | 'subscription'>('register');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [stripePromise, setStripePromise] = useState<any>(null);

  // Load subscription plan and payment config
  useEffect(() => {
    const loadData = async () => {
      try {
        const [planResponse, configResponse] = await Promise.all([
          realEstateAPI.getSubscriptionPlan(),
          realEstateAPI.getPaymentConfig()
        ]);
        
        setSubscriptionPlan(planResponse.plan);
        setPaymentConfig(configResponse);
        
        // Initialize Stripe if we have the key
        if (configResponse.stripe.publishable_key) {
          setStripePromise(loadStripe(configResponse.stripe.publishable_key));
        }
      } catch (error) {
        console.error('Failed to load subscription data:', error);
        setErrors({ general: 'Failed to load payment options. Please refresh and try again.' });
      }
    };
    loadData();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Check if email already exists before proceeding
    setSubmitting(true);
    try {
      const emailCheck = await realEstateAPI.checkEmail(formData.email);
      
      if (emailCheck.exists) {
        setErrors({ 
          email: 'This email is already registered. Please use a different email.',
          general: 'Email already registered. If this is your account, please login instead.'
        });
        return;
      }

      // Email is available, move to subscription step
      setStep('subscription');
    } catch (error) {
      console.error('Email check failed:', error);
      setErrors({ 
        general: 'Unable to verify email availability. Please try again.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStripePaymentSuccess = async (paymentMethodId: string) => {
    await createSubscriptionWithPayment('stripe', paymentMethodId);
  };



  const handlePaymentError = (error: string) => {
    setErrors({ general: error });
    setSubmitting(false);
  };

  const createSubscriptionWithPayment = async (provider: 'stripe', paymentToken: string) => {
    setSubmitting(true);
    setErrors({});

    try {
      const response = await realEstateAPI.createSubscription({
        plan: 'premium',
        payment_provider: provider,
        payment_token: paymentToken,
        name: formData.name,
        email: formData.email,
        password: formData.password
      });

      if (response.success) {
        // Successful payment, redirect to login
        navigate('/login', { 
          state: { message: 'Account created and subscription activated! Please log in to continue.' }
        });
      } else {
        setErrors({ general: response.message || 'Account creation failed' });
      }
    } catch (error) {
      console.error('Subscription creation error:', error);
      setErrors({ 
        general: error instanceof Error ? error.message : 'Account creation failed' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              Sign up to access premium Japanese real estate listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {errors.general && (
                <Alert variant="destructive">
                  <AlertDescription>{errors.general}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password"
                  className={errors.password ? "border-red-500" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  className={errors.confirmPassword ? "border-red-500" : ""}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking Email...
                  </>
                ) : (
                  'Continue to Subscription'
                )}
              </Button>

              <div className="flex flex-col space-y-2">
                <p className="text-xs text-center text-slate-500">
                  Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Login here</Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Subscription step
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle>Complete Your Subscription</CardTitle>
          <CardDescription>
            Subscribe to create your account and access premium listings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {errors.general && (
              <Alert variant="destructive">
                <AlertDescription>{errors.general}</AlertDescription>
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
                    amount={subscriptionPlan?.price || 15}
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
                onClick={() => setStep('register')}
                className="flex-1"
                disabled={submitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>

            <p className="text-xs text-center text-slate-500">
              By subscribing, you agree to our terms of service and privacy policy.
              Your account will be created when payment is processed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
