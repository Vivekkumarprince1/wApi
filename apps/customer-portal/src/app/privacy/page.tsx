import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-6">Privacy Policy</h1>
        
        <div className="prose prose-blue max-w-none text-gray-600">
          <p className="lead text-lg mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
          <p className="mb-4">
            We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. How We Use Information</h2>
          <p className="mb-4">
            We use the information we collect to provide, maintain, and improve our services, such as to process transactions, authenticate users, and provide customer support.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Information Sharing</h2>
          <p className="mb-4">
            We do not share your personal information with third parties except as described in this privacy policy, such as with your consent or to comply with the law.
          </p>
        </div>
      </div>
    </div>
  );
}
