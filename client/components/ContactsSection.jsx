import React, { useState, useEffect } from 'react';
import { FaAddressBook, FaDownload, FaPlus, FaSearch, FaFilter } from 'react-icons/fa';
import CreateContactModal from './CreateContactModal';
import ContactDetailModal from './ContactDetailModal';
import AddToPipelineModal from './AddToPipelineModal';
import { fetchContacts, post, get } from '../lib/api';
import { toast } from 'react-toastify';

const ContactsSection = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, withEmail, withoutEmail

  // Detail & CRM modals
  const [selectedContact, setSelectedContact] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddToPipelineModalOpen, setIsAddToPipelineModalOpen] = useState(false);

  // Fetch contacts from backend
  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await fetchContacts();
      setContacts(res.contacts || []);
    } catch (err) {
      setContacts([]);
    }
    setLoading(false);
  };

  const openWhatsAppProfile = async (phone, id) => {
    try {
      // Fetch profile using centralized API
      const data = await get(`/contacts/${id}/whatsapp-profile`);
      // Show simple alert for now — can be replaced with modal
      if (data && data.profile && data.profile.contact) {
        const info = data.profile.contact;
        toast?.info?.(`WhatsApp profile for ${phone}: Status: ${info.status}`) ||
          alert(`WhatsApp profile for ${phone}: \nStatus: ${info.status} \nWa ID: ${info.wa_id || info.id || 'N/A'}`);
      } else {
        toast?.warn?.('No WhatsApp profile found for this contact') ||
          alert('No WhatsApp profile found for this contact');
      }
    } catch (err) {
      toast?.error?.(err.message || 'Failed to fetch profile') ||
        alert(err.message || 'Failed to fetch profile');
    }
  };

  const handleOpenDetailModal = (contact) => {
    setSelectedContact(contact);
    setIsDetailModalOpen(true);
  };

  const handleOpenAddToPipelineModal = (contact) => {
    setSelectedContact(contact);
    setIsDetailModalOpen(false);
    setIsAddToPipelineModalOpen(true);
  };

  const handleAddToPipelineSuccess = (deal) => {
    // Refresh contacts to update any CRM data
    loadContacts();
    setIsAddToPipelineModalOpen(false);
  };

  useEffect(() => {
    loadContacts();
    // Expose refresh for upload modal
    window.refreshContacts = loadContacts;
    return () => { window.refreshContacts = undefined; };
  }, []);

  const totalContacts = contacts.length;
  const activeContacts = contacts.length; // Placeholder, add status logic if needed
  const newThisMonth = contacts.filter(c => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const groups = 0; // Placeholder

  // Filtered contacts
  const filteredContacts = contacts.filter(c => {
    // Filter by search term
    const term = searchTerm.toLowerCase();
    const matches =
      (c.firstName && c.firstName.toLowerCase().includes(term)) ||
      (c.lastName && c.lastName.toLowerCase().includes(term)) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term));
    // Filter by filter dropdown
    if (filter === 'withEmail') {
      return matches && c.email;
    } else if (filter === 'withoutEmail') {
      return matches && !c.email;
    }
    return matches;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <FaAddressBook className="text-white text-2xl" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Contacts</h1>
                  <p className="text-white/90 text-sm mt-1">Manage your customer database</p>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              {/* Import Contacts Button */}
              <button 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv';
                  input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const text = event.target.result;
                          const rows = text.split('\n').slice(1);
                          let imported = 0;
                          for (const row of rows) {
                            if (row.trim()) {
                              const [firstName, lastName, phone, email] = row.split(',');
                              await post('/contacts', {
                                firstName: firstName?.trim(),
                                lastName: lastName?.trim(),
                                phone: phone?.trim(),
                                email: email?.trim()
                              });
                              imported++;
                            }
                          }
                          toast?.success?.(`${imported} contacts imported successfully!`) ||
                            alert(`${imported} contacts imported successfully!`);
                          loadContacts();
                        } catch (err) {
                          toast?.error?.('Error importing contacts: ' + err.message) ||
                            alert('Error importing contacts: ' + err.message);
                        }
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md border border-white/30"
              >
                <FaDownload className="text-sm" />
                <span className="font-medium">Import</span>
              </button>
              
              {/* Add Contact Button */}
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center space-x-2 bg-white text-[#13C18D] px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-xl font-semibold hover:scale-105"
              >
                <FaPlus className="text-sm" />
                <span>Add Contact</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#13C18D] focus:border-transparent"
              />
            </div>
            {/* Filter Dropdown */}
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#13C18D] focus:border-transparent"
            >
              <option value="all">All Contacts</option>
              <option value="withEmail">With Email</option>
              <option value="withoutEmail">Without Email</option>
            </select>
            {/* Filter Icon */}
            <button className="p-3 text-gray-500 hover:text-[#13C18D] dark:text-gray-400 dark:hover:text-[#13C18D] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors" title="Filter options">
              <FaFilter className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] rounded-xl shadow-md">
                <FaAddressBook className="text-white text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Contacts</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] bg-clip-text text-transparent">{totalContacts}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FaAddressBook className="text-blue-500 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Contacts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeContacts}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <FaAddressBook className="text-yellow-500 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New This Month</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{newThisMonth}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <FaAddressBook className="text-purple-500 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Groups</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{groups}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Contacts</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</td></tr>
                ) : filteredContacts.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">No contacts found.</td></tr>
                ) : (
                  filteredContacts.slice(0, 20).map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetailModal(c)}
                          className="w-full text-left flex items-center hover:opacity-80 transition-opacity"
                        >
                          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-medium">{(c.firstName || c.lastName) ? `${(c.firstName||'')[0] || ''}${(c.lastName||'')[0] || ''}`.toUpperCase() : c.phone[0]}</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{c.firstName || '-'} {c.lastName || ''}</div>
                          </div>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <button onClick={() => openWhatsAppProfile(c.phone, c._id)} className="text-left text-blue-600 hover:underline">{c.phone}</button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{c.email || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Create Contact Modal */}
      <CreateContactModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      
      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedContact(null);
          }}
          contact={selectedContact}
          onAddToPipeline={() => {
            setIsDetailModalOpen(false);
            handleOpenAddToPipelineModal(selectedContact);
          }}
          onSuccess={() => {
            setIsDetailModalOpen(false);
            setSelectedContact(null);
            // Refresh contacts list by re-fetching
            window.location.reload();
          }}
        />
      )}
      
      {/* Add to Pipeline Modal */}
      {selectedContact && (
        <AddToPipelineModal
          isOpen={isAddToPipelineModalOpen}
          onClose={() => {
            setIsAddToPipelineModalOpen(false);
            setSelectedContact(null);
          }}
          contact={selectedContact}
          onSuccess={(deal) => {
            setIsAddToPipelineModalOpen(false);
            setSelectedContact(null);
            handleAddToPipelineSuccess(deal);
          }}
        />
      )}
    </div>
  );
};

export default ContactsSection; 