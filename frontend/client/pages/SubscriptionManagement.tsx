import React from 'react';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import { Layout } from '@/components/layout/Layout';

export default function SubscriptionManagementPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Subscription Management
        </h1>
        <SubscriptionManagement />
      </div>
    </Layout>
  );
} 