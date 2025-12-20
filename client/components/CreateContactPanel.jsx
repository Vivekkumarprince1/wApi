'use client';

import React, { useState } from 'react';
import { FaTimes, FaPlus } from 'react-icons/fa';

const CreateContactPanel = ({ isOpen, onClose }) => {
  const [method, setMethod] = useState('manual'); // 'manual' or 'automated'
  const [uploadMethod, setUploadMethod] = useState('bulk'); // 'bulk' or 'individual'
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    whatsappOpted: 'yes',
    contactDealValue: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
    // You can add API call here
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="ml-auto relative w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Contacts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Method Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Choose a Method to Create Contacts.
            </h3>
            <div className="flex space-x-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  value="manual"
                  checked={method === 'manual'}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Manual</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  value="automated"
                  checked={method === 'automated'}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Automated</span>
              </label>
            </div>
          </div>

          {/* Conditional Content based on method */}
          {method === 'automated' ? (
            // Automated - Show Integrations
            <div className="mb-6">
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search Integrations, Mobile App, API"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              {/* Integration Cards */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {/* Shopify */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🛍️</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Shopify</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          By installing our Shopify marketing app, all customers placing orders & abandoning checkouts in your Shopify store will be added automatically to your Interakt account.
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* Mobile App */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">📱</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Mobile App</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Effortlessly sync your mobile contacts to Interakt using our Mobile App
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* API */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-600">API</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">API</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Use Interakt's APIs to automatically add and modify contacts
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* WooCommerce */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🔷</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">WooCommerce</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          By installing our Woocommerce plugin, all customers placing orders & abandoning checkouts in your Woocommerce store will be added automatically to your Interakt account.
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* Google Sheets */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">📊</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Google Sheets</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Contacts added in rows in your Google Sheet can be auto-added to your Interakt account, by using our Google Sheet Add-On
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* FB Leads Integration */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xl font-bold text-blue-600">f</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">FB Leads Integration</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Leads filling up your FB Lead Forms can be auto-added to your Interakt account, by using our FB Leads integration.
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* Pabbly */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xl font-bold text-pink-600">P</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Pabbly</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Leads filling up your FB Lead Forms can be auto-added to your Interakt account, by using our FB Leads integration.
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* Instamojo */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">💳</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Instamojo</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          By installing our Instamojo app, all customers placing orders & abandoning checkouts in your Instamojo store will be added automatically to your Interakt account.
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>

                {/* Zapier */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">⚡</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Zapier</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Connect Interakt with thousands of apps through Zapier to automatically add contacts
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Manual - Show Bulk Upload + Individual Form
            <div className="mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <div className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                  Create Contacts Via Bulk Upload
                </div>
              </div>

              {/* CSV Upload Area */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center mb-4">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                    <FaPlus className="text-teal-600 dark:text-teal-400 text-xl" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Select a CSV file to upload
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  or drag and drop it here
                </p>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-block mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Choose File
                </label>
              </div>

              {/* Links */}
              <div className="flex items-center justify-between text-sm mb-4">
                <a href="#" className="text-teal-600 hover:underline flex items-center">
                  📺 Watch Video
                </a>
                <a href="#" className="text-teal-600 hover:underline flex items-center">
                  📥 Download sample CSV
                </a>
              </div>

              {/* Instructions */}
              <button className="w-full text-left px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded text-sm text-teal-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                Instructions to upload CSV ▼
              </button>

              <div className="my-6 flex items-center justify-center">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="mx-3 text-sm text-gray-500 dark:text-gray-400">OR</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          )}

          {/* Manual/Individual Form */}
          {method === 'manual' && (
            <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Create Contact Individually
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter input here"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <select className="px-3 py-2 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option>+91</option>
                    <option>+1</option>
                    <option>+44</option>
                  </select>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="Enter input here"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter input here"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* WhatsApp Opted */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  WhatsApp Opted
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="whatsappOpted"
                      value="yes"
                      checked={formData.whatsappOpted === 'yes'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="whatsappOpted"
                      value="no"
                      checked={formData.whatsappOpted === 'no'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">No</span>
                  </label>
                </div>
              </div>

              {/* Contact Deal Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact Deal Value
                </label>
                <input
                  type="text"
                  name="contactDealValue"
                  value={formData.contactDealValue}
                  onChange={handleInputChange}
                  placeholder="Enter input here"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateContactPanel;
