import React, { useState, useEffect } from 'react';
import { FaPlay, FaPause, FaTrash, FaEye, FaEdit, FaChartLine } from 'react-icons/fa';
import { 
  fetchCampaigns, 
  deleteCampaign, 
  getCampaignStats 
} from '../lib/api';

const CampaignList = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadCampaigns();
    loadStats();
  }, [selectedStatus, currentPage]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetchCampaigns(selectedStatus, currentPage, 10);
      setCampaigns(response.campaigns || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getCampaignStats();
      setStats(response);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleDelete = async (campaignId) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      try {
        await deleteCampaign(campaignId);
        loadCampaigns();
        loadStats();
      } catch (error) {
        console.error('Error deleting campaign:', error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'running':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Campaign History</h2>
        
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FaChartLine className="text-blue-600 text-xl mr-3" />
                <div>
                  <p className="text-sm text-blue-600">Total Campaigns</p>
                  <p className="text-2xl font-bold text-blue-800">{stats.totalCampaigns}</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FaPlay className="text-yellow-600 text-xl mr-3" />
                <div>
                  <p className="text-sm text-yellow-600">Running</p>
                  <p className="text-2xl font-bold text-yellow-800">{stats.runningCampaigns}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FaChartLine className="text-green-600 text-xl mr-3" />
                <div>
                  <p className="text-sm text-green-600">Completed</p>
                  <p className="text-2xl font-bold text-green-800">{stats.completedCampaigns}</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FaChartLine className="text-purple-600 text-xl mr-3" />
                <div>
                  <p className="text-sm text-purple-600">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-800">{stats.successRate}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No campaigns found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{campaign.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                    {campaign.message}
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">Total Contacts:</span> {campaign.totalContacts}
                    </div>
                    <div>
                      <span className="font-medium">Sent:</span> {campaign.sentCount}
                    </div>
                    <div>
                      <span className="font-medium">Failed:</span> {campaign.failedCount}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {formatDate(campaign.createdAt)}
                    </div>
                  </div>

                  {campaign.template && (
                    <div className="mt-2 text-xs text-gray-500">
                      Template: {campaign.template.name}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {/* TODO: View campaign details */}}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    title="View details"
                  >
                    <FaEye />
                  </button>
                  <button
                    onClick={() => {/* TODO: Edit campaign */}}
                    className="p-2 text-green-600 hover:text-green-800"
                    title="Edit campaign"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    className="p-2 text-red-600 hover:text-red-800"
                    title="Delete campaign"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="px-3 py-2 text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignList; 