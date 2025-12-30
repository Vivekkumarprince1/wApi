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
  getPipelines
} from '@/lib/api';
import { useSocket, useSocketEvent } from '@/lib/SocketContext';
import { 
  FaPaperPlane, 
  FaSearch, 
  FaCircle, 
  FaUser, 
  FaSpinner,
  FaCheckCircle,
  FaCheck,
  FaChevronDown,
  FaPlus,
  FaTrash
} from 'react-icons/fa';

export default function InboxPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
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
    await loadMessages(conversation.contact._id);
    // Load CRM data
    await loadCRMData(conversation.contact._id);
  };

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
    
    try {
      setSending(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contactId: selectedContact._id,
          body: newMessage
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
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
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
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
    <div className="flex h-screen bg-gray-100">
      {/* Conversation List Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold mb-4">Inbox</h1>
          
          {/* Socket Connection Status */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <FaCircle className={connected ? 'text-green-500' : 'text-red-500'} style={{ fontSize: '8px' }} />
            <span className={connected ? 'text-green-600' : 'text-red-600'}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <FaSpinner className="animate-spin text-2xl text-gray-400" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>No conversations yet</p>
              <p className="text-sm">Messages will appear here</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation._id}
                onClick={() => handleSelectContact(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedContact?._id === conversation.contact._id ? 'bg-green-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaUser className="text-green-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conversation.contact?.name || conversation.contact?.phone}
                      </h3>
                      {conversation.lastMessageAt && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {new Date(conversation.lastMessageAt).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.lastMessagePreview || 'No messages yet'}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {conversation.contact?.phone}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <FaUser className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedContact.name || selectedContact.phone}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedContact.phone}</p>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.direction === 'outbound'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="break-words">{message.body}</p>
                    <div className={`flex items-center gap-1 justify-end mt-1 text-xs ${
                      message.direction === 'outbound' ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      <span>
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
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

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
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
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <FaUser className="text-6xl mb-4" />
            <p className="text-lg">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
