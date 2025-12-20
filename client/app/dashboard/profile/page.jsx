"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logoutUser, updateProfile } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { FaBell, FaCog, FaUser, FaArrowLeft, FaSave, FaEdit } from "react-icons/fa";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  useEffect(() => {
    async function fetchUserData() {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
        setFormData({
          firstName: userData?.firstName || '',
          lastName: userData?.lastName || '',
          email: userData?.email || ''
        });
      } catch (err) {
        setError('Failed to load user data. Please login again.');
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router]);

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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      const updatedUser = await updateProfile(formData);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      // Update the user state with new data
      setUser(updatedUser);
      setFormData({
        firstName: updatedUser?.firstName || '',
        lastName: updatedUser?.lastName || '',
        email: updatedUser?.email || ''
      });
      
      // Redirect to dashboard after successful update
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
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
    <div className="flex min-h-screen bg-gradient-to-br from-[#f0f4f8] via-[#e8f0fe] to-[#f3e5f5] transition-all duration-500">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <nav className="bg-white dark:bg-gray-800 shadow px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <FaArrowLeft className="text-sm" />
              Back to Dashboard
            </button>
            <h1 className="text-xl font-semibold text-gray-700 dark:text-gray-200 tracking-wide">
              Profile Settings
            </h1>
          </div>

          {/* Right: Icons */}
          <div className="flex items-center gap-5">
            <FaBell className="text-xl text-gray-600 dark:text-gray-300 cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition" />
            <FaCog className="text-xl text-gray-600 dark:text-gray-300 cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition" />
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </nav>

        {/* Error/Success Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Profile Content */}
        <div className="p-10">
          <div className="max-w-2xl mx-auto">
            {/* Profile Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-teal-600 dark:bg-teal-500 rounded-full flex items-center justify-center">
                    <FaUser className="text-white text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  <FaEdit className="text-sm" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>
            </div>

            {/* Profile Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-6">Personal Information</h3>
              
              <div className="space-y-6">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Action Buttons */}
                {isEditing && (
                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                    >
                      <FaSave className="text-sm" />
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 