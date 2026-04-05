"use client";

import { useState, useEffect } from "react";
import { FaKey, FaCopy, FaSyncAlt, FaTrash, FaCheck, FaCode } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { get, post } from "@/lib/api";

export default function DeveloperSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ apiKeys: [] });
  const [showKeySecret, setShowKeySecret] = useState({});
  const [copied, setCopied] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [selectedKeyIdx, setSelectedKeyIdx] = useState(0);

  // New key form state
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyTemplate, setNewKeyTemplate] = useState("");

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await get("/templates?status=APPROVED");
      if (response?.success) {
        setTemplates(response.templates || []);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await get("/developer/settings");
      if (response?.success) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load developer settings");
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName) {
      toast.error("Please provide a name for the key");
      return;
    }
    try {
      setGenerating(true);
      const response = await post("/developer/keys/generate", {
        name: newKeyName,
        templateName: newKeyTemplate || null
      });
      if (response?.success) {
        toast.success("API key generated successfully");
        setNewKeyName("");
        setNewKeyTemplate("");
        fetchSettings();
      }
    } catch (error) {
      console.error("Error generating API key:", error);
      toast.error("Failed to generate API key");
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async (key) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) return;
    try {
      setRevoking(key);
      const response = await post("/developer/keys/revoke", { key });
      if (response?.success) {
        toast.success("API key revoked");
        fetchSettings();
      }
    } catch (error) {
      console.error("Error revoking key:", error);
      toast.error("Failed to revoke key");
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const resolveApiUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/v1`;
    }
    return 'https://api.yourdomain.com/api/v1';
  };

  const activeKeys = settings.apiKeys?.filter(k => k.isActive) || [];
  const selectedKey = activeKeys[selectedKeyIdx] || activeKeys[0];

  const selectedTemplateName = selectedKey?.templateName;
  const selectedTemplate = templates.find(t => t.name === selectedTemplateName);

  let variablesArrayStr = '["123456"]';

  if (selectedTemplateName && selectedTemplate?.body?.text) {
    // Find highest variable number like {{1}}, {{2}}
    const matches = selectedTemplate.body.text.match(/\{\{(\d+)\}\}/g);
    if (matches && matches.length > 0) {
      // Create an array of dummy values matching the variable count
      // E.g. {"123456"} for 1 var, {"val1", "val2"} for 2 vars
      if (matches.length === 1) {
        variablesArrayStr = '["123456"]';
      } else {
        const varArr = Array.from({ length: matches.length }, (_, i) => `value${i + 1}`);
        variablesArrayStr = JSON.stringify(varArr);
      }
    } else {
      variablesArrayStr = '[]'; // No variables in template
    }
  }

  const curlExample = `curl -X POST ${resolveApiUrl()}/external/auth/send-otp \\
  -H "x-api-key: ${selectedKey?.key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "+919876543210",
    "templateName": "${selectedTemplateName || 'otp_template_name'}",
    "variables": ${variablesArrayStr}
  }'`;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-[#13C18D] border-gray-200"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Developer Settings</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Manage multiple API keys and link them to WhatsApp templates.</p>
        </div>

        {/* API Keys Management Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">API Keys</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Create purpose-specific keys for your applications.</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Create New Key Sub-section */}
            <form onSubmit={generateKey} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Generate New Key</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Key Name (e.g. Website Signup)</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Enter purpose..."
                    className="w-full h-10 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Default Template (Optional)</label>
                  <select
                    value={newKeyTemplate}
                    onChange={(e) => setNewKeyTemplate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">None (Specify in API call)</option>
                    {templates.map(t => (
                      <option key={t._id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={generating}
                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FaSyncAlt className={generating ? "animate-spin" : ""} />
                  {generating ? "Generating..." : "Create Key"}
                </button>
              </div>
            </form>

            {/* List of Keys */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-3 text-xs font-medium text-slate-400 uppercase tracking-wider px-2">Key Name</th>
                    <th className="pb-3 text-xs font-medium text-slate-400 uppercase tracking-wider px-2">API Key</th>
                    <th className="pb-3 text-xs font-medium text-slate-400 uppercase tracking-wider px-2">Default Template</th>
                    <th className="pb-3 text-xs font-medium text-slate-400 uppercase tracking-wider px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {settings.apiKeys?.length > 0 ? (
                    settings.apiKeys.map((key) => (
                      <tr key={key.key} className={!key.isActive ? "opacity-50 grayscale bg-slate-50/50" : ""}>
                        <td className="py-4 px-2">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{key.name}</span>
                          <div className="text-[10px] text-slate-400">{new Date(key.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-mono text-xs text-indigo-600 dark:text-indigo-400 break-all">
                              {showKeySecret[key.key] ? key.key : "wk_********************************"}
                            </code>
                            <button
                              onClick={() => setShowKeySecret(prev => ({ ...prev, [key.key]: !prev[key.key] }))}
                              className="text-slate-400 hover:text-indigo-500 transition-colors"
                            >
                              <FaKey className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => copyToClipboard(key.key)}
                              className="text-slate-400 hover:text-indigo-500 transition-colors"
                            >
                              <FaCopy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <span className="text-sm text-slate-500 italic">
                            {key.templateName || "None"}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-right">
                          {key.isActive ? (
                            <button
                              onClick={() => revokeKey(key.key)}
                              disabled={revoking === key.key}
                              className="p-2 text-slate-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Revoke Key"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Revoked</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400 italic">No API keys generated yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Documentation Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <FaCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">API Documentation</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Trigger OTP messages using your API keys</p>
              </div>
            </div>

            {activeKeys.length > 1 && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-500 px-2">Snippet for:</span>
                <select
                  value={selectedKeyIdx}
                  onChange={(e) => setSelectedKeyIdx(parseInt(e.target.value))}
                  className="text-xs font-semibold bg-white dark:bg-slate-900 border-none rounded py-1 pl-2 pr-6 outline-none"
                >
                  {activeKeys.map((k, i) => (
                    <option key={k.key} value={i}>{k.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-gray-900 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 bg-gray-800/50 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
              </div>
              <span className="text-xs font-mono text-gray-400">Example Request (cURL)</span>
              <button
                onClick={() => copyToClipboard(curlExample)}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                {copied ? <FaCheck className="text-green-400" /> : <FaCopy />}
              </button>
            </div>
            <div className="p-5 overflow-x-auto">
              <pre className="font-mono text-sm leading-relaxed text-[#13C18D]">
                {curlExample}
              </pre>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800">
              <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-400 mb-1">Key Fallback Logic</h4>
              <p className="text-xs text-indigo-600 dark:text-indigo-500/80 leading-relaxed">
                If the <code>templateName</code> is linked to your API key, it will be used automatically unless you specify a different one in your request body.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800">
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">Security Warning</h4>
              <p className="text-xs text-amber-600 dark:text-amber-500/80 leading-relaxed">
                Keep your API keys secret. If a key is compromised, revoke it immediately and generate a new one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
