import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, Calendar, Shield, Edit, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { realEstateAPI } from '@/shared/api';

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Name update state
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  
  // Password update state
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertDescription>Please log in to view account settings.</AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleNameUpdate = async () => {
    if (!newName.trim()) {
      setMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    setLoading(true);
    try {
      await realEstateAPI.updateUserName(newName);
      await refreshUser(); // Refresh user data to get updated name
      setMessage({ type: 'success', text: 'Name updated successfully!' });
      setIsEditingName(false);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update name' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'All password fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setLoading(true);
    try {
      await realEstateAPI.updateUserPassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setIsEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update password' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Account Settings
        </h1>

        <div className="grid gap-6">
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Your account details and basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="name"
                      value={isEditingName ? newName : user.name}
                      onChange={(e) => setNewName(e.target.value)}
                      disabled={!isEditingName}
                      className={isEditingName ? '' : 'bg-gray-50'}
                    />
                    {!isEditingName ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingName(true);
                          setNewName(user.name);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={handleNameUpdate}
                          disabled={loading}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingName(false);
                            setNewName(user.name);
                          }}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      value={user.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="role">Account Type</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="role"
                      value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      disabled
                      className="bg-gray-50"
                    />
                    <Shield className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="created">Member Since</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="created"
                      value={formatDate(user.created_at)}
                      disabled
                      className="bg-gray-50"
                    />
                    <Calendar className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Update */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isEditingPassword ? (
                <Button
                  variant="outline"
                  onClick={() => setIsEditingPassword(true)}
                  className="flex items-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Change Password
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handlePasswordUpdate}
                      disabled={loading}
                    >
                      Update Password
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Manage your account and subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={() => window.location.href = '/subscription'}
                  className="flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
              <CardDescription>
                Current status of your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  user.is_active ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm">
                  Account is {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Last updated: {formatDate(user.updated_at)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
} 