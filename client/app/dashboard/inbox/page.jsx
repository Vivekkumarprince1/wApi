'use client';

import { useState, useEffect, useRef } from 'react';
import {
  fetchContacts,
  getDealsByContact,
  moveDealStage,
  addDealNote,
  getPipelines,
  get,
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
  FaTimes,
  FaPlayCircle,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaTags,
  FaArchive,
  FaClock,
  FaUserCircle
} from 'react-icons/fa';
import { useWorkspace } from '@/lib/useWorkspace';

export default function InboxPage() {
  const workspace = useWorkspace();
  const bspReady = workspace.stage1Complete && ['CONNECTED', 'RESTRICTED'].includes(workspace.phoneStatus);
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [contactOptions, setContactOptions] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedStartContact, setSelectedStartContact] = useState(null);
  const [startMessage, setStartMessage] = useState('');
  const [startingConversation, setStartingConversation] = useState(false);
  const messagesEndRef = useRef(null);

  // CRM State
  const [activeDeal, setActiveDeal] = useState(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [pipelines, setPipelines] = useState([]);

  const { socket, connected } = useSocket();

  const [currentView, setCurrentView] = useState('all');

  // Load conversations on mount or when view changes
  useEffect(() => {
    loadConversations();
  }, [currentView]);

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
      const response = await get(`/inbox?view=${currentView}&limit=100`);
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await get(`/inbox/${conversationId}/messages?limit=100`);
      setMessages(response.data || []);

      // Mark as read
      await post(`/inbox/${conversationId}/read`, {});

      // Update conversation unread count
      setConversations(prev => prev.map(conv =>
        conv._id === conversationId
          ? { ...conv, myUnreadCount: 0, unreadCount: 0 }
          : conv
      ));

      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSelectContact = async (conversation) => {
    setSelectedContact(conversation.contact);
    setSelectedConversationId(conversation._id || conversation.id || null);
    await loadMessages(conversation._id || conversation.id);
    // Load CRM data
    await loadCRMData(conversation.contact._id);
  };

  const openStartConversationModal = async () => {
    setStartModalOpen(true);
    setContactSearch('');
    setSelectedStartContact(null);
    setStartMessage('');
    try {
      const contactsRes = await fetchContacts(1, 50, '');
      setContactOptions(contactsRes?.data || contactsRes?.contacts || []);
    } catch (error) {
      console.error('Failed to load contacts for start conversation:', error);
      setContactOptions([]);
    }
  };

  const handleSearchStartContacts = async (value) => {
    setContactSearch(value);
    try {
      const contactsRes = await fetchContacts(1, 50, value);
      setContactOptions(contactsRes?.data || contactsRes?.contacts || []);
    } catch (error) {
      console.error('Failed to search contacts:', error);
    }
  };

  const handleStartConversation = async () => {
    if (!selectedStartContact || !startMessage.trim()) return;
    if (!bspReady) {
      toast?.error?.('Connect WhatsApp to start conversation') || alert('Connect WhatsApp to start conversation');
      return;
    }

    try {
      setStartingConversation(true);
      await post('/messages/send', {
        contactId: selectedStartContact._id || selectedStartContact.id,
        phone: selectedStartContact.phone,
        name: selectedStartContact.name,
        body: startMessage.trim()
      });

      toast?.success?.('First message queued. Conversation will appear shortly.');
      setStartModalOpen(false);
      setStartMessage('');
      setSelectedStartContact(null);
      await loadConversations();
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast?.error?.(error.message || 'Failed to start conversation');
    } finally {
      setStartingConversation(false);
    }
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
    if (!bspReady) {
      toast?.error?.('Connect WhatsApp to send messages') || alert('Connect WhatsApp to send messages');
      return;
    }

    try {
      setSending(true);

      let data;
      if (selectedConversationId) {
        data = await post(`/inbox/${selectedConversationId}/messages`, {
          text: newMessage
        });
      } else {
        data = await post('/messages/send', {
          contactId: selectedContact._id || selectedContact.id,
          phone: selectedContact.phone,
          name: selectedContact.name,
          body: newMessage
        });
      }

      const sentMessage = data?.data?.message || null;

      // Optimistically add message to UI
      const optimisticMessage = {
        _id: sentMessage?._id || data?.id || `tmp-${Date.now()}`,
        body: newMessage,
        direction: 'outbound',
        status: sentMessage?.status || 'queued',
        createdAt: new Date().toISOString(),
        contact: selectedContact._id
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
      scrollToBottom();

      // Reload conversation to update preview
      loadConversations();
      if (data?.data?.fallbackUsed) {
        const templateName = data?.data?.fallbackTemplateName;
        toast?.success?.(templateName
          ? `24h window was closed, sent template: ${templateName}`
          : '24h window was closed, sent fallback template');
      } else {
        toast?.success?.('Message sent!');
      }
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
    (conv.contact?.name && conv.contact.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (conv.contact?.phone && conv.contact.phone.includes(searchTerm))
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <FaCheck className="text-gray-400 text-[10px]" />;
      case 'delivered':
        return <><FaCheck className="text-gray-400 text-[10px]" /><FaCheck className="text-gray-400 text-[10px] -ml-1.5" /></>;
      case 'read':
        return <><FaCheck className="text-blue-500 text-[10px]" /><FaCheck className="text-blue-500 text-[10px] -ml-1.5" /></>;
      case 'failed':
        return <FaCircle className="text-red-500 text-[10px]" />;
      case 'queued':
      default:
        return <FaClock className="text-gray-400 text-[10px]" />;
    }
  };

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden">
      {/* 1. Conversations List Sidebar (Left Pane) */}
      <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col z-10">
        {/* Sidebar Header */}
        <div className="pt-4 pb-2 px-4 flex items-center justify-between border-b border-gray-100">
          <h1 className="text-[22px] font-bold text-gray-800">Inbox</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={openStartConversationModal}
              className="p-2 hover:bg-green-50 rounded-full transition-colors text-green-600 tooltip group relative"
              title="New Message"
            >
              <FaPlus className="text-sm" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
              <FaFilter className="text-sm" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 bg-white">
          <div className="relative bg-gray-100 rounded-lg flex items-center px-3 py-2 border border-transparent focus-within:border-green-500 focus-within:bg-white transition-all">
            <FaSearch className="text-gray-400 text-sm flex-shrink-0" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-sm ml-2 text-gray-700 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-2 mb-2">
          {['all', 'mine', 'unassigned'].map(view => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize transition-all ${currentView === view
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Socket Status */}
        <div className="px-4 py-1 text-[11px] font-medium flex items-center gap-1.5 border-b border-gray-100">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <FaSpinner className="animate-spin text-2xl text-green-500" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <FaArchive className="text-4xl mb-3 opacity-50" />
              <p className="text-sm font-medium">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation._id}
                onClick={() => handleSelectContact(conversation)}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors flex items-start gap-3 hover:bg-gray-50 ${selectedContact?._id === conversation.contact._id ? 'bg-gray-100' : ''
                  }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0 pt-1">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    <FaUser className="text-gray-400 text-lg" />
                  </div>
                </div>

                {/* Chat Preview */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-semibold text-gray-900 truncate text-[15px]">
                      {conversation.contact?.name || conversation.contact?.phone}
                    </h3>
                    {conversation.lastMessageAt && (
                      <span className="text-[11px] text-gray-500 flex-shrink-0 ml-2">
                        {new Date(conversation.lastMessageAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-[13px] text-gray-500 truncate pr-2">
                      {conversation.lastMessagePreview || 'No messages'}
                    </p>
                    {(conversation.myUnreadCount || conversation.unreadCount || 0) > 0 && (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {conversation.myUnreadCount || conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Message Thread Area (Center Pane) */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative border-r border-gray-200 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
        {!workspace.loading && !bspReady && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-100 border-b border-yellow-200 px-4 py-2 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 text-yellow-800">
              <FaInfoCircle />
              <p className="text-sm font-medium">WhatsApp not connected. Connect account to send messages.</p>
            </div>
            <button
              onClick={() => (window.location.href = '/onboarding/esb')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
            >
              Connect App
            </button>
          </div>
        )}

        {selectedContact ? (
          <>
            {/* Chat Thread Header */}
            <div className={`px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shadow-sm z-10 ${!bspReady ? 'mt-10' : ''}`}>
              <div className="flex items-center gap-4 cursor-pointer">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  <FaUser className="text-gray-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-base leading-tight">
                    {selectedContact.name || selectedContact.phone}
                  </h2>
                  <p className="text-xs text-green-600 font-medium">Click for contact info</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-gray-500">
                <button className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="Resolve">
                  <FaArchive className="text-sm" />
                </button>
                <button className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="More options">
                  <FaEllipsisV className="text-sm" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 relative"
              style={{
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                backgroundRepeat: 'repeat',
                backgroundSize: '400px',
                backgroundBlendMode: 'overlay',
                backgroundColor: '#efeae2'
              }}
            >
              {messages.map((message) => {
                const isOutbound = message.direction === 'outbound';
                const isTemplate = message.type === 'template';

                return (
                  <div key={message._id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} w-full`}>
                    <div
                      className={`relative max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] rounded-lg shadow-sm ${isOutbound
                        ? 'bg-[#dcf8c6] rounded-tr-none'
                        : 'bg-white rounded-tl-none'
                        }`}
                    >
                      {/* Triangle tail */}
                      <span className={`absolute top-0 w-4 h-4 
                        ${isOutbound ? '-right-3 text-[#dcf8c6]' : '-left-3 text-white'}`}
                      >
                        <svg viewBox="0 0 8 13" width="8" height="13" fill="currentColor">
                          {isOutbound
                            ? <path d="M5.188 1H0v11.156L7.969 4.343z" />
                            : <path d="M1.533 3.568L8 12.193V1H2.812z" />
                          }
                        </svg>
                      </span>

                      {/* Header Media */}
                      {message.template?.header?.format === 'IMAGE' && message.template.header.mediaUrl && (
                        <div className="p-1 pb-0">
                          <div className="relative w-full overflow-hidden rounded-md bg-black/5">
                            <img
                              src={message.template.header.mediaUrl}
                              alt="Image"
                              className="w-full h-auto max-h-[250px] object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                        </div>
                      )}

                      {message.template?.header?.format === 'VIDEO' && message.template.header.mediaUrl && (
                        <div className="p-1 pb-0">
                          <div className="relative w-full aspect-video bg-black rounded-md flex items-center justify-center overflow-hidden group border border-black/10">
                            <video src={message.template.header.mediaUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition">
                              <FaPlayCircle className="text-white text-4xl opacity-90" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-2 pt-1.5 px-2.5 pb-2">
                        {isTemplate && isOutbound && (
                          <div className="mb-1 flex items-center justify-between gap-2 border-b border-black/10 pb-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                              <FaInfoCircle /> Template
                            </span>
                          </div>
                        )}

                        <div className="text-[14.5px] leading-[1.35] text-[#111b21] whitespace-pre-wrap font-normal drop-words">
                          {message.body}
                        </div>

                        {/* Timestamp & Status */}
                        <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 float-right clear-both 
                          ${(message.body || '').length < 30 ? 'ml-4' : 'w-full'}`}
                        >
                          <span className="text-[10.5px] text-gray-500 opacity-90 relative top-[1px]">
                            {new Date(message.createdAt).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                          {isOutbound && (
                            <div className="ml-1 -mr-1">
                              {getStatusIcon(message.status)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {message.template?.buttons?.length > 0 && (
                        <div className="flex flex-col border-t border-black/5">
                          {message.template.buttons.map((btn, idx) => (
                            <button
                              key={idx}
                              className="w-full py-2.5 px-3 text-[13.5px] font-medium text-[#00a884] flex justify-center items-center gap-2 border-b border-black/5 last:border-b-0 hover:bg-black/5 active:bg-black/10 transition-colors"
                              onClick={() => {
                                if (btn.type === 'URL' && btn.url) window.open(btn.url, '_blank');
                                if (btn.type === 'PHONE_NUMBER' && btn.phoneNumber) window.location.href = `tel:${btn.phoneNumber}`;
                              }}
                            >
                              {btn.type === 'URL' && <FaExternalLinkAlt className="text-[11px]" />}
                              {btn.type === 'PHONE_NUMBER' && <FaPhoneAlt className="text-[11px]" />}
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Compose Input Box */}
            <div className="bg-[#f0f2f5] px-4 py-3 flex items-end gap-3 justify-center">
              <button type="button" className="p-2.5 text-gray-500 hover:text-gray-700 transition-colors">
                <FaSmile className="text-xl" />
              </button>
              <button type="button" className="p-2.5 text-gray-500 hover:text-gray-700 transition-colors">
                <FaPaperclip className="text-xl" />
              </button>

              <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 focus-within:border-gray-300 transition-colors">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newMessage.trim()) handleSendMessage(e);
                    }
                  }}
                  placeholder="Type a message..."
                  className="w-full max-h-32 min-h-[44px] bg-transparent border-none py-3 px-4 text-[15px] focus:ring-0 resize-none text-gray-700 placeholder-gray-400 block"
                  rows={1}
                  disabled={sending}
                />
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!bspReady || sending || !newMessage.trim()}
                className={`p-3 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${newMessage.trim() && !sending && bspReady
                  ? 'bg-[#00a884] hover:bg-[#008f6f] text-white shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {sending ? <FaSpinner className="animate-spin text-lg" /> : <FaPaperPlane className="text-lg translate-x-[-1px] translate-y-[1px]" />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f0f2f5] border-l border-gray-200">
            <div className="w-[280px] text-center">
              <div className="mx-auto w-[250px] aspect-square bg-[#e2e8f0] rounded-full flex items-center justify-center mb-8 shadow-inner overflow-hidden relative">
                <FaUserCircle className="text-[260px] text-gray-300 absolute -bottom-5" />
              </div>
              <h3 className="text-[32px] font-light text-[#41525d] mb-4">Interakt Inbox</h3>
              <p className="text-[14px] text-[#8696a0] leading-relaxed">
                Send and receive messages without keeping your phone online.<br />
                Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Sidebar: Context Panel (Smart Card / Details) */}
      {selectedContact && (
        <div className="w-[320px] lg:w-[350px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto z-30 hidden md:flex">

          {/* Contact Header Card */}
          <div className="p-6 flex flex-col items-center justify-center bg-[#f0f2f5] border-b border-gray-200 text-center">
            <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center mb-4 overflow-hidden border-2 border-white shadow-sm">
              <FaUserCircle className="text-[100px] text-white" />
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-1">
              {selectedContact.name || selectedContact.phone}
            </h2>
            <p className="text-sm text-gray-500 font-medium tracking-wide">
              {selectedContact.phone}
            </p>
          </div>

          {/* CRM / Deal Pipeline Section */}
          <div className="p-0 flex-1 bg-white">

            <div className="border-b border-gray-100 last:border-b-0">
              <button className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors text-gray-800 font-semibold group">
                <span className="flex items-center gap-2"><FaInfoCircle className="text-gray-400 group-hover:text-green-500" /> Personal Details</span>
                <FaChevronDown className="text-xs text-gray-400" />
              </button>
              <div className="px-5 pb-4 text-sm text-gray-600 bg-white">
                <div className="grid grid-cols-[100px_1fr] gap-y-2">
                  <span className="text-gray-400">Name</span>
                  <span className="font-medium text-gray-800">{selectedContact.name || '-'}</span>
                  <span className="text-gray-400">Phone</span>
                  <span className="font-medium text-gray-800">{selectedContact.phone}</span>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-100">
              <button className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors text-gray-800 font-semibold group">
                <span className="flex items-center gap-2"><FaTags className="text-gray-400 group-hover:text-green-500" /> Tags</span>
                <FaChevronDown className="text-xs text-gray-400" />
              </button>
              <div className="px-5 pb-4">
                <div className="flex flex-wrap gap-2">
                  {/* Placeholder tags */}
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold uppercase rounded-md border border-gray-200">Customer</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[11px] font-bold uppercase rounded-md border border-blue-100">WhatsApped</span>
                </div>
              </div>
            </div>

            {/* Sales Pipeline Data */}
            <div className="border-b border-gray-100">
              <button className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors text-gray-800 font-semibold group">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm12-3c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zM3 19V6l12-3v13M3 19c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                  </svg>
                  Sales Pipeline
                </span>
                <FaChevronDown className="text-xs text-gray-400" />
              </button>
              <div className="px-5 pb-4 bg-white">
                {crmLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <FaSpinner className="animate-spin text-green-500 text-lg" />
                  </div>
                ) : activeDeal ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Pipeline</label>
                      <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 border border-gray-200 rounded-md">
                        {activeDeal.pipelineName || 'Default Pipeline'}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Stage</label>
                      <select
                        value={activeDeal.stage || ''}
                        onChange={(e) => handleMoveStage(e.target.value)}
                        disabled={updatingStage}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:border-green-500 outline-none transition-colors"
                      >
                        <option value="">Select stage...</option>
                        {activeDeal.pipelineStages && activeDeal.pipelineStages.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {activeDeal.value && (
                      <div className="flex justify-between items-center py-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Value</span>
                        <span className="text-sm font-bold text-gray-900">${activeDeal.value}</span>
                      </div>
                    )}

                    {/* Notes Section within CRM */}
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Internal Notes</label>

                      <form onSubmit={handleAddNote} className="mb-3">
                        <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 focus-within:bg-white focus-within:border-green-400 overflow-hidden pr-1">
                          <input
                            type="text"
                            placeholder="Add a note..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            disabled={addingNote}
                            className="flex-1 px-3 py-2 text-sm bg-transparent border-none focus:ring-0 outline-none placeholder-gray-400"
                          />
                          <button
                            type="submit"
                            disabled={addingNote || !newNote.trim()}
                            className="p-1.5 bg-green-100 text-green-600 rounded flex items-center justify-center hover:bg-green-200 disabled:opacity-50 transition-colors"
                          >
                            {addingNote ? <FaSpinner className="animate-spin" /> : <FaPlus className="text-xs" />}
                          </button>
                        </div>
                      </form>

                      {activeDeal.notes && activeDeal.notes.length > 0 && (
                        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                          {activeDeal.notes.map((note, idx) => (
                            <div key={idx} className="bg-yellow-50 px-3 py-2 rounded-md border border-yellow-100/50">
                              <p className="text-[13px] text-gray-800 leading-snug">{note.text}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(note.createdAt).toLocaleString(undefined, {
                                  month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 border border-gray-100 rounded-lg border-dashed">
                    <p className="text-sm text-gray-500 px-4">No active pipeline deal found for this contact.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Start Conversation Modal */}
      {startModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Start New Conversation</h3>
              <button
                onClick={() => setStartModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Select Contact</label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => handleSearchStartContacts(e.target.value)}
                    placeholder="Search by name or phone"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-sm transition-all"
                  />
                </div>

                <div className="mt-3 max-h-48 overflow-y-auto border border-gray-100 rounded-lg shadow-inner bg-gray-50">
                  {contactOptions.length > 0 ? (
                    contactOptions.map((contact) => (
                      <button
                        key={contact._id}
                        type="button"
                        onClick={() => setSelectedStartContact(contact)}
                        className={`w-full text-left px-4 py-3 border-b last:border-b-0 border-gray-100 transition-colors flex justify-between items-center ${selectedStartContact?._id === contact._id
                          ? 'bg-green-50 border-green-100'
                          : 'hover:bg-white bg-white'
                          }`}
                      >
                        <div>
                          <p className={`font-semibold text-sm ${selectedStartContact?._id === contact._id ? 'text-green-800' : 'text-gray-800'}`}>
                            {contact.name || contact.phone}
                          </p>
                          {contact.name && (
                            <p className="text-xs text-gray-500 mt-0.5">{contact.phone}</p>
                          )}
                        </div>
                        {selectedStartContact?._id === contact._id && (
                          <FaCheckCircle className="text-green-500" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-gray-500 bg-white">
                      No contacts found. Please add a contact in the Sales CRM tab first.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">First Message</label>
                <textarea
                  value={startMessage}
                  onChange={(e) => setStartMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-sm transition-all resize-none"
                />
                <div className="flex items-start gap-2 mt-2 px-1">
                  <FaInfoCircle className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-600/80 leading-snug">
                    Sending a message to a new contact outside the 24h window will use standard template pricing.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setStartModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartConversation}
                disabled={startingConversation || !selectedStartContact || !startMessage.trim()}
                className="px-6 py-2 text-sm font-bold rounded-lg bg-[#00a884] text-white hover:bg-[#008f6f] focus:ring-4 focus:ring-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
              >
                {startingConversation ? (
                  <><FaSpinner className="animate-spin" /> Sending...</>
                ) : (
                  <><FaPaperPlane /> Send Message</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
