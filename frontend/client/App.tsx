import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import RootRedirect from "@/components/RootRedirect";
import Listings from "./pages/Listings";
import Favorites from "./pages/Favorites";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import SubscriptionManagementPage from "./pages/SubscriptionManagement";
import AccountSettings from "./pages/AccountSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth routes - no layout wrapper */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Root route - redirects based on auth status */}
            <Route path="/" element={<RootRedirect />} />

            {/* Protected routes - with layout wrapper */}
            <Route 
              path="/subscription/manage" 
              element={
                <ProtectedRoute>
                  <SubscriptionManagementPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/listings" 
              element={
                <Layout>
                  <ProtectedRoute>
                    <Listings />
                  </ProtectedRoute>
                </Layout>
              } 
            />

            <Route 
              path="/account" 
              element={
                <ProtectedRoute>
                  <AccountSettings />
                </ProtectedRoute>
              } 
            />

            {/* Future protected routes can be added here */}
            <Route 
              path="/favorites" 
              element={
                <Layout>
                  <ProtectedRoute>
                    <Favorites />
                  </ProtectedRoute>
                </Layout>
              } 
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
