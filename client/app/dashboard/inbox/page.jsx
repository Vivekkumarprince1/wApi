'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  fetchConversations, 
  fetchMessageThread, 
  fetchConversationByContact,
  markConversationAsRead,
  getDealsByContact,
  moveDealStage,
  addDealNote,
  getPipelines,
  post
} from '@/lib/api';
import { useSocket, useSocketEvent } from '@/lib/SocketContext';
import { toast } from 'react-toastify';
import { 
  FaPaperPlane, 
  FaSearch, 
  FaCircle, 
  FaUser, 
  FaSpinner,
  FaCheckCircle,
  FaCheck,
  FaFilter,
  FaEllipsisV,
  FaPhoneAlt,
  FaVideo,
  FaSmile,
  FaPaperclip,
  FaChevronDown,
  FaPlus,
  FaTrash,
  FaClock
} from 'react-icons/fa';
import { useWorkspace } from '@/lib/useWorkspace';

export default function InboxPage() {
  const workspace = useWorkspace();
  const bspReady = workspace.canSendMessages;
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);
  
  // CRM State
  const [activeDeal, setActiveDeal] = useState(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [pipelines, setPipelines] = useState([]);
  
  const { socket, connected } = useSocket();

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Listen for real-time message events
  useSocketEvent('message.received', (data) => {
    console.log('New message received:', data);
    
    // Update conversation list
    loadConversations();
    
    // If this message is for the currently selected contact, add it to messages
    if (selectedContact && data.contact._id === selectedContact._id) {
      setMessages(prev => [...prev, data.message]);
      scrollToBottom();
    }
  });

  // Listen for message status updates
  useSocketEvent('message.status', (data) => {
    console.log('Message status updated:', data);
    
    // Update message status in current thread
    setMessages(prev => prev.map(msg => 
      msg._id === data.messageId 
        ? { ...msg, status: data.status }
        : msg
    ));
  });

  // Listen for typing indicators
  useSocketEvent('user.typing', (data) => {
    console.log('User typing:', data);
    // Could show typing indicator in UI
  });

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetchConversations({ limit: 100 });
      setConversations(response.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (contactId) => {
    try {
      const response = await fetchMessageThread(contactId, { limit: 100 });
      setMessages(response.messages || []);
      
      // Mark as read
      await markConversationAsRead(contactId);
      
      // Update conversation unread count
      setConversations(prev => prev.map(conv => 
        conv.contact._id === contactId 
          ? { ...conv, unreadCount: 0 }
          : conv
      ));
      
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSelectContact = async (conversation) => {
    setSelectedContact(conversation.contact);
    setSelectedConversation(conversation);
    await loadMessages(conversation.contact._id);
    // Load CRM data
    await loadCRMData(conversation.contact._id);
  };

  const isSessionOpen = (() => {
    const lastCustomerMessageAt = selectedConversation?.lastCustomerMessageAt;
    if (!lastCustomerMessageAt) return false;
    const windowMs = 24 * 60 * 60 * 1000;
    return Date.now() - new Date(lastCustomerMessageAt).getTime() < windowMs;
  })();

  const loadCRMData = async (contactId) => {
    try {
      setCrmLoading(true);
      const deals = await getDealsByContact(contactId);
      // Get the active deal (most recent non-completed deal)
      const active = deals.length > 0 ? deals[0] : null;
      setActiveDeal(active);
    } catch (error) {
      console.error('Error loading CRM data:', error);
      setActiveDeal(null);
    } finally {
      setCrmLoading(false);
    }
  };

  const handleMoveStage = async (newStage) => {
    if (!activeDeal) return;
    try {
      setUpdatingStage(true);
      const updated = await moveDealStage(activeDeal._id, newStage);
      setActiveDeal(updated);
    } catch (error) {
      console.error('Error updating stage:', error);
      alert('Failed to update stage');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !activeDeal) return;
    
    try {
      setAddingNote(true);
      const updated = await addDealNote(activeDeal._id, newNote);
      setActiveDeal(updated);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedContact) return;
    if (!bspReady) {
      toast?.error?.('Connect WhatsApp to send messages') || alert('Connect WhatsApp to send messages');
      return;
    }
    if (!isSessionOpen) {
      toast?.error?.('24-hour session expired. Use an approved template to re-open the session.') ||
        alert('24-hour session expired. Use an approved template to re-open the session.');
      return;
    }
    
    try {
      setSending(true);
      
      // Use centralized API helper with proper auth
      const data = await post('/messages/send', {
        contactId: selectedContact._id,
        body: newMessage
      });
      
      // Optimistically add message to UI
      const optimisticMessage = {
        _id: data.id,
        body: newMessage,
        direction: 'outbound',
        status: 'queued',
        createdAt: new Date().toISOString(),
        contact: selectedContact._id
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
      scrollToBottom();
      
      // Reload conversation to update preview
      loadConversations();
      toast?.success?.('Message sent!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast?.error?.(error.message || 'Failed to send message') || alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const filteredConversations = conversations.filter(conv => 
    conv.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.contact?.phone?.includes(searchTerm)
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <FaCheck className="text-gray-400 text-xs" />;
      case 'delivered':
        return <><FaCheck className="text-gray-400 text-xs" /><FaCheck className="text-gray-400 text-xs -ml-2" /></>;
      case 'read':
        return <><FaCheck className="text-blue-500 text-xs" /><FaCheck className="text-blue-500 text-xs -ml-2" /></>;
      case 'failed':
        return <FaCircle className="text-red-500 text-xs" />;
      default:
        return <FaCircle className="text-gray-300 text-xs" />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Conversation List Sidebar */}
      <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#13C18D] to-[#0e8c6c]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white">Inbox</h1>
            <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <FaFilter className="text-white" />
            </button>
          </div>
          
          {/* Socket Connection Status */}
          <div className="flex items-center gap-2 mb-4 text-sm bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
            <FaCircle className={connected ? 'text-green-400' : 'text-red-400'} style={{ fontSize: '8px' }} />
            <span className="text-white font-medium">
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
          
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-700 border-0 rounded-xl focus:ring-2 focus:ring-white shadow-lg text-gray-900 dark:text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <FaSpinner className="animate-spin text-3xl text-[#13C18D]" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-6">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <FaUser className="text-3xl text-gray-400" />
              </div>
              <p className="font-semibold text-lg">No conversations yet</p>
              <p className="text-sm text-center mt-2">Your messages will appear here when customers reach out</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation._id}
                onClick={() => handleSelectContact(conversation)}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md ${
                  selectedContact?._id === conversation.contact._id 
                    ? 'bg-gradient-to-r from-[#13C18D]/10 to-[#0e8c6c]/10 border-l-4 border-l-[#13C18D]' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                      <FaUser className="text-white text-lg" />
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {conversation.contact?.name || conversation.contact?.phone}
                      </h3>
                      {conversation.lastMessageAt && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {new Date(conversation.lastMessageAt).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                      {conversation.lastMessagePreview || 'No messages yet'}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {conversation.contact?.phone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
        {!workspace.loading && !bspReady && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">WhatsApp not connected</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">Connect your WhatsApp account to send messages.</p>
            </div>
            <button
              onClick={() => (window.location.href = '/onboarding/esb')}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Connect Now
            </button>
          </div>
        )}
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] rounded-full flex items-center justify-center shadow-lg">
                    <FaUser className="text-white text-lg" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-gray-900 dark:text-white">
                      {selectedContact.name || selectedContact.phone}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedContact.phone}</p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <FaPhoneAlt className="text-gray-600 dark:text-gray-400" />
                  </button>
                  <button className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <FaVideo className="text-gray-600 dark:text-gray-400" />
                  </button>
                  <button className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <FaEllipsisV className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* CRM Section */}
            {crmLoading ? (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <FaSpinner className="animate-spin text-green-500 text-sm" />
                <span className="text-sm text-gray-600">Loading CRM data...</span>
              </div>
            ) : activeDeal ? (
              <div className="px-4 py-4 bg-blue-50 border-b border-blue-200">
                <div className="text-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">Sales Pipeline</h3>
                  
                  {/* Pipeline & Stage */}
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-600 block mb-1">Pipeline</label>
                    <p className="text-sm font-medium text-gray-900">{activeDeal.pipelineName || 'Unknown'}</p>
                  </div>
                  
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-600 block mb-1">Stage</label>
                    <select
                      value={activeDeal.stage || ''}
                      onChange={(e) => handleMoveStage(e.target.value)}
                      disabled={updatingStage}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    >
                      <option value="">Select stage...</option>
                      {activeDeal.pipelineStages && activeDeal.pipelineStages.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Deal Value & Agent */}
                  {activeDeal.value && (
                    <div className="mb-2 text-sm">
                      <span className="text-gray-600">Deal Value: </span>
                      <span className="font-semibold">${activeDeal.value}</span>
                    </div>
                  )}
                  
                  {activeDeal.assignedAgent && (
                    <div className="text-sm text-gray-600 mb-3">
                      <span>Agent: {activeDeal.assignedAgent}</span>
                    </div>
                  )}
                  
                  {/* Quick Note Add */}
                  <form onSubmit={handleAddNote} className="mt-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        disabled={addingNote}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <button
                        type="submit"
                        disabled={addingNote || !newNote.trim()}
                        className="px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                      >
                        <FaPlus />
                      </button>
                    </div>
                  </form>
                  
                  {/* Notes List */}
                  {activeDeal.notes && activeDeal.notes.length > 0 && (
                    <div className="mt-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium text-gray-600 mb-2">Notes:</p>
                      {activeDeal.notes.map((note, idx) => (
                        <div key={idx} className="text-xs bg-white p-2 rounded mb-1 border border-gray-200">
                          <p className="text-gray-900">{note.text}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {new Date(note.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-6 space-y-4"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2313c18d\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                backgroundColor: '#f8faf9'
              }}
            >
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-3 rounded-2xl shadow-md ${
                      message.direction === 'outbound'
                        ? 'bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <p className="break-words leading-relaxed">{message.body}</p>
                    <div className={`flex items-center gap-2 justify-end mt-2 text-xs ${
                      message.direction === 'outbound' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      <span>
                        {new Date(message.createdAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                      {message.direction === 'outbound' && (
                        <span className="ml-1">{getStatusIcon(message.status)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Session + Safety Banner */}
            <div className="px-6 pt-4 pb-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className={`text-xs font-medium rounded-lg px-3 py-2 inline-flex items-center gap-2 ${
                isSessionOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <FaClock />
                {isSessionOpen ? 'Session open (24-hour window active)' : 'Session expired — templates required'}
              </div>
              {workspace.degradation?.degraded && (
                <div className="mt-2 text-xs text-red-600">
                  {workspace.degradation.message || 'Messaging is restricted due to account health.'}
                </div>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FaSmile className="text-gray-600 dark:text-gray-400 text-xl" />
                </button>
                <button
                  type="button"
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FaPaperclip className="text-gray-600 dark:text-gray-400 text-xl" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-5 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl focus:ring-2 focus:ring-[#13C18D] text-gray-900 dark:text-white placeholder-gray-500"
                  disabled={sending || !bspReady || !isSessionOpen}
                />
                <button
                  type="submit"
                  disabled={!bspReady || !isSessionOpen || sending || !newMessage.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold transition-all transform hover:scale-105"
                >
                  {sending ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaPaperPlane />
                  )}
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="w-32 h-32 bg-gradient-to-br from-[#13C18D]/20 to-[#0e8c6c]/20 rounded-full flex items-center justify-center mb-6">
              <FaUser className="text-6xl text-[#13C18D]" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to Inbox
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400 text-center max-w-md">
              Select a conversation from the left to view messages and start chatting with your customers
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
