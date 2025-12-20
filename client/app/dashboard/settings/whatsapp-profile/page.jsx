'use client';

import { useState, useEffect } from 'react';
import { FaWhatsapp, FaEdit, FaSave, FaImage } from 'react-icons/fa';
import * as api from '@/lib/api';

export default function WhatsAppProfilePage() {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    businessName: '',
    about: '',
    address: '',
    description: '',
    email: '',
    websites: [],
    vertical: 'OTHER',
    profilePictureUrl: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.getWABASettings();
      if (response.profile) {
        setProfileData(response.profile);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.updateWABASettings({ profile: profileData });
      setEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <FaWhatsapp className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApp Business Profile</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manage your WhatsApp Business account settings</p>
            </div>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <FaEdit /> Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                <FaSave /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        {loading && !editing ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading profile...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                  {profileData.profilePictureUrl ? (
                    <img src={profileData.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <FaImage className="text-gray-400 text-2xl" />
                  )}
                </div>
                {editing && (
                  <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
                    Upload New Picture
                  </button>
                )}
              </div>
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Business Name *
              </label>
              <input
                type="text"
                name="businessName"
                value={profileData.businessName}
                onChange={handleInputChange}
                disabled={!editing}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Enter your business name"
              />
            </div>

            {/* About */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                About
              </label>
              <textarea
                name="about"
                value={profileData.about}
                onChange={handleInputChange}
                disabled={!editing}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Tell customers about your business"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={profileData.description}
                onChange={handleInputChange}
                disabled={!editing}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Detailed business description"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={profileData.address}
                onChange={handleInputChange}
                disabled={!editing}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Business address"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={profileData.email}
                onChange={handleInputChange}
                disabled={!editing}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="business@example.com"
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Industry
              </label>
              <select
                name="vertical"
                value={profileData.vertical}
                onChange={handleInputChange}
                disabled={!editing}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="OTHER">Other</option>
                <option value="AUTO">Automotive</option>
                <option value="BEAUTY">Beauty, Spa and Salon</option>
                <option value="APPAREL">Clothing and Apparel</option>
                <option value="EDU">Education</option>
                <option value="ENTERTAIN">Entertainment</option>
                <option value="EVENT_PLAN">Event Planning and Service</option>
                <option value="FINANCE">Finance and Banking</option>
                <option value="GROCERY">Grocery and Retail</option>
                <option value="GOVT">Government</option>
                <option value="HOTEL">Hotel and Lodging</option>
                <option value="HEALTH">Medical and Health</option>
                <option value="NONPROFIT">Non-profit</option>
                <option value="PROF_SERVICES">Professional Services</option>
                <option value="RETAIL">Retail</option>
                <option value="TRAVEL">Travel and Transportation</option>
                <option value="RESTAURANT">Restaurant</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
