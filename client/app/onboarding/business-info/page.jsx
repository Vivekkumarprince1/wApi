'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BusinessInfoPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/esb');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center space-y-3">
        <p className="text-sm text-slate-600">Business info collection is now automated inside Embedded Signup.</p>
        <p className="text-base font-semibold text-slate-900">Start ESB to let Meta collect and verify business details.</p>
        <button
          onClick={() => router.push('/esb')}
          className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Launch Embedded Signup
        </button>
      </div>
    </div>
  );
}
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
