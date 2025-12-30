'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaChevronDown, FaChevronUp, FaCheckCircle } from 'react-icons/fa';
import { fetchTemplates, createAd } from '@/lib/api';

export default function CreateAdPage() {
  const router = useRouter();
  
  // Form state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  
  // Step 2: Budget & Targeting
  const [budget, setBudget] = useState(1000); // Default $10/day
  const [currency, setCurrency] = useState('USD');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [countries, setCountries] = useState([]);
  const [countryInput, setCountryInput] = useState('');
  
  // Step 3: Template & CTA
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('Message us on WhatsApp');
  const [ctaText, setCtaText] = useState('Message us');
  
  // Step 4: Review & Submit
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await fetchTemplates({ status: 'APPROVED' });
      setTemplates(data.templates || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load templates: ' + err.message);
      setLoading(false);
    }
  };

  const handleAddCountry = () => {
    if (countryInput && !countries.includes(countryInput)) {
      setCountries([...countries, countryInput.toUpperCase()]);
      setCountryInput('');
    }
  };

  const handleRemoveCountry = (country) => {
    setCountries(countries.filter(c => c !== country));
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!name.trim()) {
          setError('Campaign name is required');
          return false;
        }
        if (!scheduleStart) {
          setError('Start date is required');
          return false;
        }
        if (new Date(scheduleStart) < new Date()) {
          setError('Start date must be in the future');
          return false;
        }
        if (scheduleEnd && new Date(scheduleEnd) <= new Date(scheduleStart)) {
          setError('End date must be after start date');
          return false;
        }
        break;
        
      case 2:
        if (budget < 100 || budget > 10000000) {
          setError('Daily budget must be between $1.00 and $100,000');
          return false;
        }
        break;
        
      case 3:
        if (!selectedTemplate) {
          setError('Please select a template');
          return false;
        }
        if (!welcomeMessage.trim()) {
          setError('Welcome message is required');
          return false;
        }
        break;
        
      case 4:
        if (!agreed) {
          setError('You must agree to Meta ads policies to continue');
          return false;
        }
        break;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    try {
      setSubmitting(true);
      
      const adData = {
        name,
        objective: 'MESSAGES',
        budget,
        currency,
        scheduleStart,
        scheduleEnd: scheduleEnd || null,
        template: selectedTemplate,
        welcomeMessage,
        ctaText,
        targeting: {
          ageMin: parseInt(ageMin),
          ageMax: parseInt(ageMax),
          countries,
          genders: ['MALE', 'FEMALE'],
          interests: [],
          behaviors: [],
          customAudiences: [],
          excludedAudiences: []
        }
      };

      const response = await createAd(adData);
      
      if (response.success) {
        router.push(`/dashboard/ads?success=Ad created: ${name}`);
      } else {
        setError(response.error || 'Failed to create ad');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const progressPercentage = (step / 4) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Create WhatsApp Ad</h1>
        <p className="text-gray-600 mt-1">Step {step} of 4: {['Basic Info', 'Budget & Targeting', 'Template & CTA', 'Review'][step - 1]}</p>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                  s <= step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s < step ? <FaCheckCircle /> : s}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Campaign Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Black Friday Sale"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                A descriptive name to identify this ad campaign
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <input
                  type="datetime-local"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Budget & Targeting */}
        {step === 2 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Budget & Targeting</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Budget *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">$</span>
                  <input
                    type="number"
                    value={budget / 100}
                    onChange={(e) => setBudget(Math.round(parseFloat(e.target.value) * 100))}
                    step="0.01"
                    min="1"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Minimum $1.00/day
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Age Targeting</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Age
                  </label>
                  <input
                    type="number"
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                    min="13"
                    max="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Age
                  </label>
                  <input
                    type="number"
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                    min="13"
                    max="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Geographic Targeting</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                  placeholder="Country code (e.g., US, IN, UK)"
                  maxLength="2"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCountry()}
                />
                <button
                  onClick={handleAddCountry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {countries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {countries.map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full"
                    >
                      {country}
                      <button
                        onClick={() => handleRemoveCountry(country)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Template & CTA */}
        {step === 3 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Template & Message</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Template *
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a template...</option>
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Only APPROVED templates are available
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Welcome Message *
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Message shown when user opens chat"
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                This message appears in the chat window when users click your ad
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Button Text
              </label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="e.g., Message us"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Review & Confirm</h2>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Campaign Name:</span>
                <span className="font-semibold text-gray-900">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Daily Budget:</span>
                <span className="font-semibold text-gray-900">${(budget / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Target Ages:</span>
                <span className="font-semibold text-gray-900">{ageMin} - {ageMax}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Countries:</span>
                <span className="font-semibold text-gray-900">
                  {countries.length > 0 ? countries.join(', ') : 'Worldwide'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Start Date:</span>
                <span className="font-semibold text-gray-900">
                  {new Date(scheduleStart).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="border-t pt-6">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  I agree to Meta's advertising policies and understand that WhatsApp ads may be subject to review and approval. My ad must comply with all policies and cannot promote illegal content.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between gap-4">
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            className={`px-6 py-2 rounded-lg font-medium ${
              step === 1
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gray-300 hover:bg-gray-400 text-gray-900'
            }`}
          >
            Previous
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Ad'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
