'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Plus, Search, X } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  fetchTemplateRules,
  createTemplateRule,
  updateTemplateRule,
  deleteTemplateRule,
  toggleTemplateRule,
  testTemplateRule,
  getRuleStats
} from '@/lib/api';
import TemplateRuleEditor from '@/components/templates/TemplateRuleEditor';
import TemplateRuleList from '@/components/templates/TemplateRuleList';

export default function TemplateRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [triggerTypeFilter, setTriggerTypeFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [testingRuleId, setTestingRuleId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadRules();
  }, [pagination.page, triggerTypeFilter, searchTerm]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (triggerTypeFilter) params.triggerType = triggerTypeFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await fetchTemplateRules(params);
      setRules(response.data || []);
      setPagination({
        ...pagination,
        total: response.total || 0
      });
    } catch (error) {
      console.error('Failed to load rules:', error);
      toast.error('Failed to load template rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingRule(null);
    setShowEditor(true);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingRule(null);
  };

  const handleSaveRule = async (ruleData) => {
    try {
      setLoading(true);
      if (ruleData.id) {
        await updateTemplateRule(ruleData.id, ruleData);
        toast.success('Rule updated successfully');
      } else {
        await createTemplateRule(ruleData);
        toast.success('Rule created successfully');
      }
      handleCloseEditor();
      loadRules();
    } catch (error) {
      console.error('Failed to save rule:', error);
      toast.error(error.message || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;

    try {
      setLoading(true);
      await deleteTemplateRule(ruleId);
      toast.success('Rule deleted successfully');
      loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (ruleId, enabled) => {
    try {
      await toggleTemplateRule(ruleId, enabled);
      toast.success(enabled ? 'Rule enabled' : 'Rule disabled');
      loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleTestRule = async (ruleId) => {
    try {
      setTestingRuleId(ruleId);
      const response = await testTemplateRule(ruleId, {
        triggerData: { type: 'message', content: 'test message' }
      });
      setTestResult(response);
      toast.success('Rule test completed');
      setTimeout(() => {
        setTestingRuleId(null);
        setTestResult(null);
      }, 5000);
    } catch (error) {
      console.error('Failed to test rule:', error);
      toast.error('Failed to test rule');
      setTestingRuleId(null);
    }
  };

  const handleGetStats = async (ruleId) => {
    try {
      const response = await getRuleStats(ruleId);
      return response.stats;
    } catch (error) {
      console.error('Failed to load stats:', error);
      return null;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Template Auto-Triggers</h1>
              <p className="text-gray-600">Create rules to automatically send templates</p>
            </div>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <Plus size={18} />
            New Rule
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-xs relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPagination({ ...pagination, page: 1 });
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <select
            value={triggerTypeFilter}
            onChange={(e) => {
              setTriggerTypeFilter(e.target.value);
              setPagination({ ...pagination, page: 1 });
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
          >
            <option value="">All Trigger Types</option>
            <option value="message_keyword">Message Keyword</option>
            <option value="conversation_event">Conversation Event</option>
            <option value="user_action">User Action</option>
            <option value="time_trigger">Time-based</option>
            <option value="custom">Custom</option>
            <option value="instagram_comment">Instagram Comment</option>
            <option value="instagram_dm">Instagram DM</option>
            <option value="instagram_story_reply">Instagram Story Reply</option>
          </select>
        </div>
      </div>

      {/* Test Result Alert */}
      {testResult && (
        <div className={`mb-6 p-4 rounded-lg border ${
          testResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
            {testResult.message || (testResult.success ? 'Rule test passed' : 'Rule test failed')}
          </p>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TemplateRuleList
          rules={rules}
          loading={loading}
          pagination={pagination}
          onEdit={handleEdit}
          onDelete={handleDeleteRule}
          onToggle={handleToggleRule}
          onTest={handleTestRule}
          onStats={handleGetStats}
          onPageChange={(page) => setPagination({ ...pagination, page })}
        />
      </div>

      {/* Rule Editor Modal */}
      {showEditor && (
        <TemplateRuleEditor
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={handleCloseEditor}
        />
      )}
    </div>
  );
}
