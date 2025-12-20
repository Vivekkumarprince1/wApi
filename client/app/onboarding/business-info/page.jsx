'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaBuilding, FaIndustry, FaUsers, FaGlobe, FaMapMarkerAlt, FaFileAlt, FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { post, get } from '@/lib/api';

const INDUSTRIES = [
  'E-commerce',
  'Retail',
  'Healthcare',
  'Education',
  'Real Estate',
  'Finance',
  'Technology',
  'Travel & Hospitality',
  'Food & Beverage',
  'Marketing & Advertising',
  'Other'
];

const COMPANY_SIZES = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '500+ employees'
];

const DOCUMENT_TYPES = [
  { value: 'gst', label: 'GST Number' },
  { value: 'msme', label: 'MSME/Udyam Number' },
  { value: 'pan', label: 'PAN Number' }
];

// Verification status badge component
const VerificationStatusBadge = ({ status }) => {
  const statusConfig = {
    'not_submitted': { 
      color: 'bg-gray-100 text-gray-700 border-gray-300', 
      icon: FaExclamationTriangle, 
      label: 'Not Submitted' 
    },
    'pending': { 
      color: 'bg-yellow-100 text-yellow-700 border-yellow-300', 
      icon: FaClock, 
      label: 'Pending Review' 
    },
    'in_review': { 
      color: 'bg-blue-100 text-blue-700 border-blue-300', 
      icon: FaClock, 
      label: 'Under Review' 
    },
    'verified': { 
      color: 'bg-green-100 text-green-700 border-green-300', 
      icon: FaCheckCircle, 
      label: 'Verified' 
    },
    'rejected': { 
      color: 'bg-red-100 text-red-700 border-red-300', 
      icon: FaExclamationTriangle, 
      label: 'Rejected' 
    }
  };

  const config = statusConfig[status] || statusConfig['not_submitted'];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};

export default function BusinessInfoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metaResult, setMetaResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  const [formData, setFormData] = useState({
    businessName: '',
    industry: '',
    companySize: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    zipCode: '',
    description: '',
    // Document fields
    documentType: '',
    gstNumber: '',
    msmeNumber: '',
    panNumber: ''
  });

  // Fetch current verification status on load
  useEffect(() => {
    const fetchVerificationStatus = async () => {
      try {
        const data = await get('/onboarding/verification-status');
        setVerificationStatus(data);
      } catch (err) {
        console.error('Failed to fetch verification status:', err);
      } finally {
        setLoadingStatus(false);
      }
    };
    fetchVerificationStatus();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  // Validate GST Number format (15 characters)
  const validateGST = (gst) => {
    if (!gst) return true;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst.toUpperCase());
  };

  // Validate MSME/Udyam Number format
  const validateMSME = (msme) => {
    if (!msme) return true;
    const msmeRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/i;
    return msmeRegex.test(msme.toUpperCase());
  };

  // Validate PAN Number format
  const validatePAN = (pan) => {
    if (!pan) return true;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.businessName || !formData.industry) {
      setError('Business name and industry are required');
      return;
    }

    // Validate document
    if (!formData.gstNumber && !formData.msmeNumber && !formData.panNumber) {
      setError('Please provide at least one official document (GST, MSME, or PAN) for business verification. This is required by Meta/WhatsApp.');
      return;
    }

    if (formData.gstNumber && !validateGST(formData.gstNumber)) {
      setError('Invalid GST Number format. Expected format: 22AAAAA0000A1Z5 (15 characters)');
      return;
    }

    if (formData.msmeNumber && !validateMSME(formData.msmeNumber)) {
      setError('Invalid MSME/Udyam Number format. Expected format: UDYAM-XX-00-0000000');
      return;
    }

    if (formData.panNumber && !validatePAN(formData.panNumber)) {
      setError('Invalid PAN Number format. Expected format: ABCDE1234F (10 characters)');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setMetaResult(null);
      setShowResult(false);

      // Determine document type automatically if not set
      let documentType = formData.documentType;
      if (!documentType) {
        if (formData.gstNumber) documentType = 'gst';
        else if (formData.msmeNumber) documentType = 'msme';
        else if (formData.panNumber) documentType = 'pan';
      }

      // Submit to API
      const data = await post('/onboarding/business-info', {
        ...formData,
        documentType,
        gstNumber: formData.gstNumber?.toUpperCase(),
        msmeNumber: formData.msmeNumber?.toUpperCase(),
        panNumber: formData.panNumber?.toUpperCase()
      });

      // Update verification status from response
      if (data.verificationStatus) {
        setVerificationStatus({ 
          status: data.verificationStatus,
          message: getVerificationStatusMessage(data.verificationStatus)
        });
      }

      // Show result
      if (data.metaResult) {
        setMetaResult(data.metaResult);
        if (data.metaResult.error) {
          // If Meta submission failed but local save succeeded
          setError(`Business info saved. Note: ${data.metaResult.error}`);
        }
      } else {
        setMetaResult({ success: true });
      }
      setShowResult(true);
    } catch (err) {
      console.error('Submit error:', err);
      // Provide more helpful error messages
      if (err.message.includes('TOKEN_EXPIRED')) {
        setError('Your session has expired. Please log in again and try once more.');
      } else if (err.message.includes('verification')) {
        setError(`Business verification issue: ${err.message}. Please check your document numbers and try again.`);
      } else {
        setError(err.message || 'Failed to save business information. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get verification status message
  const getVerificationStatusMessage = (status) => {
    const messages = {
      'not_submitted': 'Business verification not yet submitted.',
      'pending': 'Your verification documents are being reviewed.',
      'in_review': 'Business verification is currently under review by Meta.',
      'verified': 'Your business is verified!',
      'rejected': 'Verification was rejected. Please check the details and resubmit.'
    };
    return messages[status] || 'Unknown status';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 2 of 4</span>
            <span className="text-sm font-medium text-green-600">Business Information</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{ width: '50%' }}></div>
          </div>
        </div>

        {/* Verification Status Banner */}
        {!loadingStatus && verificationStatus && (
          <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Verification Status</h3>
                <p className="text-xs text-gray-500 mt-1">{verificationStatus.message}</p>
              </div>
              <VerificationStatusBadge status={verificationStatus.status} />
            </div>
            {verificationStatus.status === 'rejected' && verificationStatus.verificationDetails?.rejectionReason && (
              <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                <strong>Rejection Reason:</strong> {verificationStatus.verificationDetails.rejectionReason}
              </div>
            )}
          </div>
        )}

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Tell us about your business
        </h1>
        <p className="text-gray-600 mb-8">
          This information helps us customize your WhatsApp Business experience and verify your business.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Name *
            </label>
            <div className="relative">
              <FaBuilding className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                required
                placeholder="Enter your business name"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Industry *
            </label>
            <div className="relative">
              <FaIndustry className="absolute left-3 top-3 text-gray-400" />
              <select
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Company Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Size
            </label>
            <div className="relative">
              <FaUsers className="absolute left-3 top-3 text-gray-400" />
              <select
                name="companySize"
                value={formData.companySize}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
              >
                <option value="">Select company size</option>
                {COMPANY_SIZES.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <div className="relative">
              <FaGlobe className="absolute left-3 top-3 text-gray-400" />
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <div className="relative">
              <FaMapMarkerAlt className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street address"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* City, State, Country */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Zip Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zip/PIN Code
            </label>
            <input
              type="text"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleChange}
              placeholder="Enter PIN code"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Tell us what your business does..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Official Documents Section */}
          <div className="border-t pt-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FaFileAlt className="text-green-600" />
              Official Business Documents
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Provide at least one official document for business verification. This is required by Meta/WhatsApp to verify your business.
            </p>

            {/* GST Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Number
              </label>
              <input
                type="text"
                name="gstNumber"
                value={formData.gstNumber}
                onChange={handleChange}
                placeholder="e.g., 22AAAAA0000A1Z5"
                maxLength={15}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">15-character GST Identification Number</p>
            </div>

            {/* MSME Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MSME / Udyam Registration Number
              </label>
              <input
                type="text"
                name="msmeNumber"
                value={formData.msmeNumber}
                onChange={handleChange}
                placeholder="e.g., UDYAM-XX-00-0000000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">Udyam Registration Number for MSME</p>
            </div>

            {/* PAN Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PAN Number
              </label>
              <input
                type="text"
                name="panNumber"
                value={formData.panNumber}
                onChange={handleChange}
                placeholder="e.g., ABCDE1234F"
                maxLength={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">10-character Permanent Account Number</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push('/onboarding/verify-email')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
            >
              {loading ? 'Saving...' : 'Submit for Verification'}
            </button>
          </div>
        </form>

        {/* Submission result */}
        {showResult && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-semibold mb-2">Submission Result</h3>
            {metaResult?.testMode ? (
              <div className="text-purple-700">
                <div className="flex items-center gap-2">
                  <FaFlask />
                  <span>Business information saved in <strong>Test Mode</strong>.</span>
                </div>
                <p className="mt-2 text-sm">All features are enabled for testing. Submit official documents for production use.</p>
              </div>
            ) : metaResult?.success ? (
              <div className="text-green-700">
                <div className="flex items-center gap-2">
                  <FaCheckCircle />
                  <span>Business verification submitted successfully!</span>
                </div>
                <p className="mt-2 text-sm">Meta will review your documents. This usually takes 2-5 business days.</p>
              </div>
            ) : (
              <div className="text-red-700">
                <p>Business information saved locally.</p>
                <p className="mt-2">Meta submission returned an error: <strong>{metaResult?.error || 'Unknown error'}</strong></p>
                {metaResult?.requiresManualSubmission || (metaResult?.error && metaResult.error.includes && metaResult.error.includes('REQUIRES_BUSINESS_MANAGER')) ? (
                  <div className="mt-3">
                    <p className="text-sm text-gray-700">This action requires Business Manager. Please submit manually:</p>
                    <a
                      className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
                      href={`https://business.facebook.com/wa/manage/message-templates/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Business Manager
                    </a>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => router.push('/onboarding/connect-whatsapp')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Continue to Connect WhatsApp
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 border rounded-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
