"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logoutUser, updateProfile, get } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ArrowLeft, Save, Pencil, User, X } from 'lucide-react';

export default function Profile() {
  const router = useRouter();
  const { user: authUser, loading: authLoading, logout } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  useEffect(() => {
    if (authLoading) return;
    if (authUser) {
      setUser(authUser);
      setFormData({
        firstName: authUser.name?.split(' ')[0] || '',
        lastName: authUser.name?.split(' ').slice(1).join(' ') || '',
        email: authUser.email || ''
      });
      setLoading(false);
    } else {
      setError('Failed to load user data. Please login again.');
      router.push('/');
    }
  }, [authUser, authLoading, router]);

  useEffect(() => {
    const loadWorkspaceProfile = async () => {
      if (!authUser) return;
      try {
        const session = await get('/auth/me');
        setWorkspaceInfo(session?.workspace || null);
      } catch (_err) {
        // Keep page functional even if workspace details fail to load
      }
    };

    loadWorkspaceProfile();
  }, [authUser]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.push('/');
    } catch (err) {
      setError('Failed to logout. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const updatedUser = await updateProfile(formData);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setUser(updatedUser);
      setFormData({
        firstName: updatedUser?.firstName || '',
        lastName: updatedUser?.lastName || '',
        email: updatedUser?.email || ''
      });
      setTimeout(() => { router.push('/dashboard'); }, 1500);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || ''
    });
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="animate-fade-in-up">
      {/* Top Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
        </div>
      </div>

      {/* Error/Success */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/5 border border-destructive/20 text-destructive rounded-xl text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm">{success}</div>
      )}

      <div className="max-w-2xl">
        {/* Profile Header */}
        <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary/80 to-primary rounded-full flex items-center justify-center">
                <User className="text-primary-foreground h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{user?.firstName} {user?.lastName}</h2>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
              </div>
            </div>
            <button onClick={() => setIsEditing(!isEditing)}
              className="btn-primary flex items-center gap-2 text-sm">
              {isEditing ? <><X className="h-4 w-4" /> Cancel</> : <><Pencil className="h-4 w-4" /> Edit Profile</>}
            </button>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Personal Information</h3>
          <div className="space-y-5">
            {[
              { label: 'First Name', name: 'firstName', type: 'text' },
              { label: 'Last Name', name: 'lastName', type: 'text' },
              { label: 'Email Address', name: 'email', type: 'email' },
            ].map(field => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-foreground mb-2">{field.label}</label>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="input-premium disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            ))}

            {isEditing && (
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm">
                  <Save className="h-4 w-4" /> Save Changes
                </button>
                <button onClick={handleCancel}
                  className="px-5 py-2.5 bg-muted text-muted-foreground hover:bg-accent rounded-xl transition-colors text-sm font-medium">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Business Profile */}
        <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6 mt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Business Information</h3>
          {workspaceInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Business Name:</span> <span className="text-foreground font-medium">{workspaceInfo?.businessInfo?.name || '-'}</span></div>
              <div><span className="text-muted-foreground">Industry:</span> <span className="text-foreground font-medium">{workspaceInfo?.businessInfo?.industry || '-'}</span></div>
              <div><span className="text-muted-foreground">Company Size:</span> <span className="text-foreground font-medium">{workspaceInfo?.businessInfo?.companySize || '-'}</span></div>
              <div><span className="text-muted-foreground">Annual Revenue:</span> <span className="text-foreground font-medium">{workspaceInfo?.businessInfo?.annualRevenue || '-'}</span></div>
              <div><span className="text-muted-foreground">Website:</span> <span className="text-foreground font-medium">{workspaceInfo?.businessInfo?.website || '-'}</span></div>
              <div><span className="text-muted-foreground">Certification:</span> <span className="text-foreground font-medium">{workspaceInfo?.documents?.documentType || '-'} {workspaceInfo?.documents?.certificationNumber ? `(${workspaceInfo.documents.certificationNumber})` : ''}</span></div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Address:</span> <span className="text-foreground font-medium">{[workspaceInfo?.businessInfo?.address, workspaceInfo?.businessInfo?.city, workspaceInfo?.businessInfo?.state, workspaceInfo?.businessInfo?.country].filter(Boolean).join(', ') || '-'}</span></div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Description:</span> <span className="text-foreground font-medium">{workspaceInfo?.businessInfo?.description || '-'}</span></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Business information not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}