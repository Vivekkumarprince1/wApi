'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaTrash, FaArrowLeft, FaSave, FaChevronDown, FaCheck, FaCode, FaMobileAlt } from 'react-icons/fa';
import Link from 'next/link';

export default function CreateFlowPage() {
  const router = useRouter();
  const [step, setStep] = useState('template'); // template or builder
  const [buildMode, setBuildMode] = useState('visual'); // visual or json
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    flowType: 'static',
    screens: [],
    rawFlowJson: '',
    config: {
      fallbackMessage: 'Please update your WhatsApp to use interactive forms.',
      saveLead: true
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedScreen, setExpandedScreen] = useState(null);

  const startBlankVisual = () => {
    setBuildMode('visual');
    setFormData({
      ...formData,
      screens: [
        {
          id: `SCREEN_${Date.now()}`,
          title: 'Welcome Screen',
          terminal: false,
          layout: {
            type: 'SingleColumnLayout',
            children: []
          }
        }
      ]
    });
    setStep('builder');
  };

  const startWithJSON = () => {
    setBuildMode('json');
    setStep('builder');
  };

  const elementTypes = [
    { value: 'TextHeading', label: 'Heading Text' },
    { value: 'TextSubheading', label: 'Subheading' },
    { value: 'TextInput', label: 'Text Input Field' },
    { value: 'TextArea', label: 'Multi-line Text Area' },
    { value: 'Dropdown', label: 'Dropdown Menu' },
    { value: 'CheckboxGroup', label: 'Checkbox selection' },
    { value: 'Footer', label: 'Submit Footer' }
  ];

  const addScreen = () => {
    const newScreen = {
      id: `SCREEN_${Date.now()}`,
      title: 'New Screen',
      terminal: false,
      layout: {
        type: 'SingleColumnLayout',
        children: []
      }
    };
    setFormData({
      ...formData,
      screens: [...formData.screens, newScreen]
    });
    setExpandedScreen(newScreen.id);
  };

  const deleteScreen = (id) => {
    setFormData({
      ...formData,
      screens: formData.screens.filter(s => s.id !== id)
    });
  };

  const updateScreen = (id, updates) => {
    setFormData({
      ...formData,
      screens: formData.screens.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const addElementToScreen = (screenId) => {
    const screen = formData.screens.find(s => s.id === screenId);
    const newElement = {
      type: 'TextInput',
      name: `field_${Date.now()}`,
      label: 'New Question',
      required: true
    };
    
    updateScreen(screenId, {
      layout: {
        ...screen.layout,
        children: [...screen.layout.children, newElement]
      }
    });
  };

  const updateElement = (screenId, elementIndex, updates) => {
    const screen = formData.screens.find(s => s.id === screenId);
    const updatedChildren = [...screen.layout.children];
    updatedChildren[elementIndex] = { ...updatedChildren[elementIndex], ...updates };
    
    updateScreen(screenId, {
      layout: { ...screen.layout, children: updatedChildren }
    });
  };

  const deleteElement = (screenId, elementIndex) => {
    const screen = formData.screens.find(s => s.id === screenId);
    const updatedChildren = screen.layout.children.filter((_, idx) => idx !== elementIndex);
    
    updateScreen(screenId, {
      layout: { ...screen.layout, children: updatedChildren }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Flow name is required');
      return;
    }

    if (buildMode === 'visual' && formData.screens.length === 0) {
      setError('Add at least one screen to your Flow');
      return;
    }
    
    if (buildMode === 'json' && !formData.rawFlowJson.trim()) {
      setError('Paste valid Match JSON payload');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let finalData = { ...formData };
      
      // Parse JSON if in code mode
      if (buildMode === 'json') {
        try {
          const parsed = JSON.parse(formData.rawFlowJson);
          finalData.rawFlowJson = parsed;
        } catch (e) {
          throw new Error("Invalid Raw Flow JSON payload. Must be strictly valid mapping.");
        }
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/whatsapp-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(finalData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Failed to create flow');
      }

      router.push(`/automation/whatsapp-forms`);
    } catch (err) {
      setError(err.message);
      console.error('Error creating flow:', err);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'template') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-12">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              <Link href="/automation/whatsapp-forms" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <FaArrowLeft className="text-slate-500" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Create Native WhatsApp Flow</h1>
                <p className="text-slate-500 mt-1">Design an interactive App-Like screen inside WhatsApp</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center text-slate-700">Choose Creation Mode</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Visual Builder Option */}
            <button
              onClick={startBlankVisual}
              className="p-8 bg-white border-2 border-slate-200 rounded-3xl hover:border-emerald-500 transition-all text-left group hover:shadow-2xl shadow-sm"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <FaMobileAlt className="text-3xl" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Visual Screen Builder</h3>
              <p className="text-slate-500">
                Design interactive App-like screens using our no-code drag-and-drop interface. Perfect for lead-gen and feedback flow.
              </p>
            </button>

            {/* FB JSON Option */}
            <button
              onClick={startWithJSON}
              className="p-8 bg-white border-2 border-slate-200 rounded-3xl hover:border-blue-500 transition-all text-left group hover:shadow-2xl shadow-sm"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <FaCode className="text-3xl" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Import Meta JSON</h3>
              <p className="text-slate-500">
                Already designed a Flow in the Facebook Business Playground? Paste the raw JSON mapping directly here.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep('template')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <FaArrowLeft className="text-slate-500" />
            </button>
            <div>
               <h1 className="text-xl font-bold text-slate-900">
                 {buildMode === 'visual' ? 'Visual Meta Flow Builder' : 'Raw JSON Ingestion'}
               </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-red-600 font-bold">
              {error}
            </div>
          )}

          {/* Form Core Details */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Flow Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Flow Reference Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Summer Lead Gen App"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Internal notes..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
            
            <div className="mt-6 flex gap-8">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config.saveLead}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, saveLead: e.target.checked }
                  })}
                  className="w-5 h-5 accent-emerald-500"
                />
                <span className="font-bold text-slate-700">Save Submissions as CRM Leads</span>
              </label>
            </div>
          </div>

          {/* JSON MODE */}
          {buildMode === 'json' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
               <h2 className="text-lg font-bold text-slate-900 mb-4 text-blue-600 flex items-center gap-2">
                 <FaCode /> Meta Flow JSON
               </h2>
               <p className="text-sm text-slate-500 mb-6">Paste the exact JSON export from your Meta Business Manager Playground. We will directly relay this structure via the API.</p>
               
               <textarea 
                 value={formData.rawFlowJson}
                 onChange={(e) => setFormData({...formData, rawFlowJson: e.target.value})}
                 className="w-full font-mono text-sm bg-slate-900 text-green-400 p-6 rounded-2xl border-none outline-none focus:ring-4 focus:ring-blue-500/20"
                 rows={25}
                 placeholder={`{
  "version": "3.0",
  "screens": [...]
}`}
               />
               
               <div className="mt-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-bold">
                 * Ensure your routing handles "data_exchange" endpoints manually if setting up a dynamic endpoint here.
               </div>
            </div>
          )}

          {/* VISUAL BUILDER MODE */}
          {buildMode === 'visual' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mt-8">
                <h2 className="text-2xl font-bold text-slate-900">App Screens ({formData.screens.length})</h2>
                <button
                  type="button"
                  onClick={addScreen}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-md"
                >
                  <FaPlus /> Add Screen
                </button>
              </div>

              {formData.screens.length === 0 && (
                <div className="p-12 border-2 border-dashed border-slate-300 rounded-3xl text-center text-slate-500 bg-white">
                  No screens built. An interactive flow needs at least one screen.
                </div>
              )}

              {formData.screens.map((screen, idx) => (
                <div key={screen.id} className="bg-white border-2 border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                  <div 
                    className="w-full px-6 py-5 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedScreen(expandedScreen === screen.id ? null : screen.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{screen.title || 'Untitled Screen'}</h3>
                        <p className="text-sm text-slate-500">
                          {screen.layout?.children?.length || 0} UI Elements • ID: {screen.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {screen.terminal && <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">Terminal Screen</span>}
                      <FaChevronDown className={`text-slate-400 transition-transform ${expandedScreen === screen.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {expandedScreen === screen.id && (
                    <div className="border-t border-slate-200 p-6 bg-slate-50 space-y-8">
                      <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Screen Title (Header)</label>
                          <input
                            type="text"
                            value={screen.title}
                            onChange={(e) => updateScreen(screen.id, { title: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Screen System ID</label>
                          <input
                            type="text"
                            value={screen.id}
                            onChange={(e) => updateScreen(screen.id, { id: e.target.value.toUpperCase().replace(/\s+/g,'_') })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 font-mono text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                           <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={screen.terminal}
                                onChange={(e) => updateScreen(screen.id, { terminal: e.target.checked })}
                                className="w-5 h-5 accent-amber-500"
                              />
                              <span className="font-bold text-slate-700">Terminal Screen (Ends the flow when submitted)</span>
                            </label>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                           <h4 className="font-bold text-slate-900">UI Elements</h4>
                           <button
                              type="button"
                              onClick={() => addElementToScreen(screen.id)}
                              className="text-sm text-emerald-600 hover:text-emerald-700 font-bold"
                           >
                              + Add Element
                           </button>
                        </div>

                        {screen.layout.children.map((el, elIdx) => (
                           <div key={elIdx} className="bg-white p-5 rounded-2xl border border-slate-200 flex gap-4">
                              <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Element Type</label>
                                    <select
                                      value={el.type}
                                      onChange={(e) => updateElement(screen.id, elIdx, { type: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50"
                                    >
                                      {elementTypes.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Reference Variable (ID)</label>
                                    <input
                                      type="text"
                                      value={el.name}
                                      onChange={(e) => updateElement(screen.id, elIdx, { name: e.target.value.toLowerCase().replace(/\s+/g,'_') })}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-blue-600"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Display Label / Text</label>
                                  <input
                                    type="text"
                                    value={el.label || el.text}
                                    onChange={(e) => updateElement(screen.id, elIdx, { label: e.target.value, text: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-primary"
                                    placeholder="Enter label text..."
                                  />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer pt-2">
                                  <input
                                    type="checkbox"
                                    checked={el.required}
                                    onChange={(e) => updateElement(screen.id, elIdx, { required: e.target.checked })}
                                    className="accent-primary"
                                  />
                                  <span className="text-sm font-bold text-slate-600">Required Field</span>
                                </label>
                              </div>
                              <div className="pt-6">
                                <button
                                  type="button"
                                  onClick={() => deleteElement(screen.id, elIdx)}
                                  className="w-10 h-10 rounded-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                           </div>
                        ))}
                      </div>

                      <div className="pt-4 flex justify-between border-t border-slate-200">
                        <span className="text-xs text-slate-400 font-mono tracking-widest uppercase">ID: {screen.id}</span>
                        <button
                          type="button"
                          onClick={() => deleteScreen(screen.id)}
                          className="text-red-500 hover:text-red-600 font-bold text-sm"
                        >
                          Delete Entire Screen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Core Actions */}
          <div className="flex gap-4 justify-end pt-8 pb-12 border-t border-slate-200">
            <Link
              href="/automation/whatsapp-forms"
              className="px-8 py-3 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-bold"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-3 px-10 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl transition-colors font-bold shadow-lg shadow-emerald-200"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaSave className="text-lg" />} 
              {loading ? 'Creating Flow...' : 'Save Draft Flow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}