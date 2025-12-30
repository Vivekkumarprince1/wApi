'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaTrash, FaArrowLeft, FaSave, FaChevronDown, FaCheck } from 'react-icons/fa';
import Link from 'next/link';

const TEMPLATES = {
  blank: {
    name: 'Blank Form',
    description: 'Start with an empty form',
    questions: []
  },
  feedback: {
    name: 'Customer Feedback',
    description: 'Collect customer feedback and suggestions',
    questions: [
      {
        id: 'q_1',
        type: 'choice',
        title: 'How would you rate your experience?',
        required: true,
        options: [
          { id: 'opt_1', label: 'Excellent', value: '5' },
          { id: 'opt_2', label: 'Good', value: '4' },
          { id: 'opt_3', label: 'Average', value: '3' },
          { id: 'opt_4', label: 'Poor', value: '1' }
        ]
      },
      {
        id: 'q_2',
        type: 'text',
        title: 'How could we improve?',
        required: false,
        options: []
      }
    ]
  },
  newsletter: {
    name: 'Newsletter Signup',
    description: 'Collect emails for your newsletter',
    questions: [
      {
        id: 'q_1',
        type: 'text',
        title: 'What is your name?',
        required: true,
        options: []
      },
      {
        id: 'q_2',
        type: 'email',
        title: 'What is your email?',
        required: true,
        options: []
      }
    ]
  },
  contact: {
    name: 'Contact Request',
    description: 'Collect contact information',
    questions: [
      {
        id: 'q_1',
        type: 'text',
        title: 'Full Name',
        required: true,
        options: []
      },
      {
        id: 'q_2',
        type: 'email',
        title: 'Email Address',
        required: true,
        options: []
      },
      {
        id: 'q_3',
        type: 'phone',
        title: 'Phone Number',
        required: false,
        options: []
      }
    ]
  },
  survey: {
    name: 'Quick Survey',
    description: 'Run a quick customer survey',
    questions: [
      {
        id: 'q_1',
        type: 'choice',
        title: 'Would you recommend us?',
        required: true,
        options: [
          { id: 'opt_1', label: 'Yes', value: 'yes' },
          { id: 'opt_2', label: 'No', value: 'no' },
          { id: 'opt_3', label: 'Maybe', value: 'maybe' }
        ]
      },
      {
        id: 'q_2',
        type: 'text',
        title: 'Why?',
        required: false,
        options: []
      }
    ]
  }
};

export default function CreateFormPage() {
  const router = useRouter();
  const [step, setStep] = useState('template'); // template or builder
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    questions: [],
    config: {
      intro: 'Please answer the following questions:',
      outro: 'Thank you! Your form has been submitted.',
      requirePhone: false,
      saveLead: true,
      sendConfirmation: true
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const startWithTemplate = (templateKey) => {
    const template = TEMPLATES[templateKey];
    setFormData({
      ...formData,
      questions: template.questions.map(q => ({
        ...q,
        id: `q_${Date.now()}_${Math.random()}`
      }))
    });
    setSelectedTemplate(templateKey);
    setStep('builder');
  };

  const questionTypes = [
    { value: 'text', label: 'Short Text' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'number', label: 'Number' },
    { value: 'choice', label: 'Multiple Choice' }
  ];

  const addQuestion = () => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      type: 'text',
      title: '',
      required: true,
      options: [],
      conditional: {
        enabled: false,
        dependsOn: '',
        dependsOnValue: ''
      }
    };
    setFormData({
      ...formData,
      questions: [...formData.questions, newQuestion]
    });
    setExpandedQuestion(newQuestion.id);
  };

  const updateQuestion = (id, updates) => {
    setFormData({
      ...formData,
      questions: formData.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    });
  };

  const deleteQuestion = (id) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== id)
    });
  };

  const addOption = (questionId) => {
    updateQuestion(questionId, {
      options: [
        ...formData.questions.find(q => q.id === questionId).options,
        { id: `opt_${Date.now()}`, label: '', value: '' }
      ]
    });
  };

  const updateOption = (questionId, optionId, updates) => {
    const question = formData.questions.find(q => q.id === questionId);
    updateQuestion(questionId, {
      options: question.options.map(o => o.id === optionId ? { ...o, ...updates } : o)
    });
  };

  const deleteOption = (questionId, optionId) => {
    const question = formData.questions.find(q => q.id === questionId);
    updateQuestion(questionId, {
      options: question.options.filter(o => o.id !== optionId)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Form name is required');
      return;
    }

    if (formData.questions.length === 0) {
      setError('Add at least one question');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/whatsapp-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create form');
      }

      const result = await response.json();
      router.push(`/automation/whatsapp-forms/edit/${result._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Error creating form:', err);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'template') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              <Link
                href="/automation/whatsapp-forms"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FaArrowLeft className="text-gray-600 dark:text-gray-400" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create WhatsApp Form</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Choose a template or start from scratch</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Choose a Template</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => startWithTemplate(key)}
                className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 dark:hover:border-green-400 transition-all text-left hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <FaCheck className="text-green-500 text-sm" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {template.questions.length} question{template.questions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setStep('template')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FaArrowLeft className="text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create WhatsApp Form</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{selectedTemplate && TEMPLATES[selectedTemplate]?.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Form Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Form Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Form Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Customer Feedback Form"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this form for?"
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config.requirePhone}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, requirePhone: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require Phone Number</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config.saveLead}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, saveLead: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Save as Lead</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config.sendConfirmation}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, sendConfirmation: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Send Confirmation</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Intro Message
              </label>
              <textarea
                value={formData.config.intro}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, intro: e.target.value }
                })}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Outro Message
              </label>
              <textarea
                value={formData.config.outro}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, outro: e.target.value }
                })}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Questions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Questions ({formData.questions.length})</h2>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <FaPlus /> Add Question
              </button>
            </div>

            <div className="space-y-4">
              {formData.questions.map((question, idx) => (
                <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                    className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="text-left flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {idx + 1}. {question.title || 'Untitled Question'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {questionTypes.find(t => t.value === question.type)?.label}
                        {question.required && ' • Required'}
                      </p>
                    </div>
                    <FaChevronDown className={`text-gray-400 transition-transform ${expandedQuestion === question.id ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedQuestion === question.id && (
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-gray-700/30 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question Title *
                        </label>
                        <input
                          type="text"
                          value={question.title}
                          onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
                          placeholder="e.g., What is your name?"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question Type
                        </label>
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestion(question.id, { type: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        >
                          {questionTypes.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {question.type === 'choice' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Options
                          </label>
                          <div className="space-y-2">
                            {question.options.map((option) => (
                              <div key={option.id} className="flex gap-2">
                                <input
                                  type="text"
                                  value={option.label}
                                  onChange={(e) => updateOption(question.id, option.id, { label: e.target.value, value: e.target.value })}
                                  placeholder="Option text"
                                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => deleteOption(question.id, option.id)}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addOption(question.id)}
                              className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                            >
                              + Add Option
                            </button>
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Required Question</span>
                      </label>

                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => deleteQuestion(question.id)}
                          className="w-full px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
                        >
                          Delete Question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end pb-8">
            <Link
              href="/automation/whatsapp-forms"
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
            >
              <FaSave /> {loading ? 'Creating...' : 'Create Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}