import React, { useState, useRef } from 'react';
import { FaTimes, FaBriefcase, FaPlay, FaDownload, FaChevronDown, FaChevronUp, FaPlus } from 'react-icons/fa';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Users, Eye, Send } from 'lucide-react';
import { uploadContacts } from '../lib/api';

const CreateContactModal = ({ isOpen, onClose }) => {
  const [contactMethod, setContactMethod] = useState('manual');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [csvData, setCsvData] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const parseCsvData = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const contact = { phone_number: '' };
      headers.forEach((header, index) => {
        if (values[index]) {
          switch (header) {
            case 'phone_number':
            case 'phone':
            case 'mobile':
              contact.phone_number = values[index];
              break;
            case 'first_name':
            case 'firstname':
              contact.first_name = values[index];
              break;
            case 'last_name':
            case 'lastname':
              contact.last_name = values[index];
              break;
            case 'email':
              contact.email = values[index];
              break;
          }
        }
      });
      if (contact.phone_number) {
        data.push(contact);
      }
    }
    return data;
  };

  const handleFile = (file) => {
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      setUploadedFile(file);
      setUploadStatus('uploading');
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvText = e.target?.result;
        const parsedData = parseCsvData(csvText);
        if (parsedData.length === 0) {
          setUploadStatus('error');
          setTimeout(() => setUploadStatus('idle'), 3000);
          return;
        }
        try {
          await uploadContacts(parsedData);
          setCsvData(parsedData);
          setUploadStatus('success');
          setShowResults(true);
          if (typeof window !== 'undefined' && typeof window.refreshContacts === 'function') {
            window.refreshContacts();
          }
        } catch (err) {
          setUploadStatus('error');
          setTimeout(() => setUploadStatus('idle'), 3000);
        }
      };
      reader.readAsText(file);
    } else {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const downloadTemplate = () => {
    const csvContent = "phone_number,first_name,last_name,email\n+919876543210,John,Doe,john@example.com\n+919876543211,Jane,Smith,jane@example.com\n+919876543212,Mike,Johnson,mike@example.com";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setUploadStatus('idle');
    setCsvData([]);
    setShowResults(false);
  };

  const validContacts = csvData.filter(contact => contact.phone_number);
  const invalidContacts = csvData.length - validContacts.length;

  const handleSubmit = () => {
    if (contactName.trim()) {
      console.log('Creating contact:', contactName);
      setContactName('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
        {/* Green bar on the right */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-green-500"></div>
        
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <FaBriefcase className="text-white text-sm" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Create Contacts</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <FaTimes className="text-gray-600 text-sm" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Bulk Upload Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 dark:text-gray-200">
                Create Contacts Via Bulk Upload
              </h3>
              {!showResults ? (
                <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6">
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
                      dragActive
                        ? 'border-green-500 bg-green-50 dark:bg-green-900'
                        : uploadStatus === 'success'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900'
                        : uploadStatus === 'error'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900'
                        : 'border-gray-300 bg-white dark:bg-gray-800 hover:border-green-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onDragEnter={() => setDragActive(true)}
                    onDragLeave={() => setDragActive(false)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleChange}
                      className="hidden"
                    />
                    {uploadStatus === 'error' ? (
                      <div className="space-y-4">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Failed</h3>
                          <p className="text-gray-600 dark:text-gray-300 mt-2">
                            Please upload a valid CSV file
                          </p>
                        </div>
                      </div>
                    ) : uploadStatus === 'uploading' ? (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto">
                          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Processing...</h3>
                          <p className="text-gray-600 dark:text-gray-300 mt-2">
                            Parsing {uploadedFile?.name}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Drop your CSV file here</h3>
                          <p className="text-gray-600 dark:text-gray-300 mt-2">
                            or click to browse your files
                          </p>
                        </div>
                        <button
                          onClick={onButtonClick}
                          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Choose File
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center mb-2">
                      <FileText className="w-5 h-5 text-blue-500 mr-2" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">CSV Format Requirements</h4>
                    </div>
                    <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <li>• Phone numbers with country code (+91)</li>
                      <li>• Required columns: phone_number</li>
                      <li>• Optional: first_name, last_name, email</li>
                      <li>• Maximum 10,000 contacts per file</li>
                    </ul>
                    <button
                      onClick={downloadTemplate}
                      className="mt-4 w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
                    >
                      <Download className="w-4 h-4 inline mr-2" />Download CSV Template
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upload Successful!</h3>
                          <p className="text-gray-600 dark:text-gray-300">Your contacts have been processed and are ready to use</p>
                        </div>
                      </div>
                      <button
                        onClick={resetUpload}
                        className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Upload New File
                      </button>
                    </div>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center">
                        <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{validContacts.length}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">Valid Contacts</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center">
                        <AlertCircle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{invalidContacts}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">Invalid Entries</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center">
                        <FileText className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{uploadedFile?.name.split('.')[0]}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">File Name</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center">
                        <Eye className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{(uploadedFile?.size || 0 / 1024).toFixed(1)} KB</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">File Size</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Contact List Preview</h4>
                        <div className="flex items-center space-x-3">
                          <button className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs">
                            <Eye className="w-4 h-4 mr-1" />Preview Campaign
                          </button>
                          <button className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs">
                            <Send className="w-4 h-4 mr-1" />Send Messages
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Phone Number</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">First Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {validContacts.slice(0, 10).map((contact, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{contact.phone_number}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{contact.first_name || '-'}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{contact.last_name || '-'}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{contact.email || '-'}</td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">Valid</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {validContacts.length > 10 && (
                      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          Showing 10 of {validContacts.length} contacts. <button className="text-green-600 hover:text-green-700 ml-1 font-medium">View all contacts</button>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* Individual Contact Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 dark:text-gray-200">
                Create Contact Individually
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Enter contact name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                {contactError && <div className="text-red-500 text-sm">{contactError}</div>}
                <button
                  onClick={async () => {
                    setContactError('');
                    if (!contactName.trim() || !contactPhone.trim()) {
                      setContactError('Name and phone are required');
                      return;
                    }
                    setContactLoading(true);
                    try {
                      await uploadContacts([{ first_name: contactName, phone_number: contactPhone, email: contactEmail }]);
                      setContactName('');
                      setContactPhone('');
                      setContactEmail('');
                      setContactError('');
                      if (typeof window !== 'undefined' && typeof window.refreshContacts === 'function') {
                        window.refreshContacts();
                      }
                    } catch (err) {
                      setContactError('Failed to add contact');
                    }
                    setContactLoading(false);
                  }}
                  disabled={contactLoading}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${contactLoading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {contactLoading ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200">
            <button
              onClick={handleSubmit}
              disabled={!contactName.trim()}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                contactName.trim()
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateContactModal; 