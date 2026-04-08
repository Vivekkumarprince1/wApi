'use client';

import Link from 'next/link';

import { useState, useEffect, useRef } from 'react';
import {
  fetchContacts,
  getDealsByContact,
  moveDealStage,
  addDealNote,
  getPipelines,
  get,
  post,
  put,
  del,
  uploadInboxMedia
} from '@/lib/api';
import { useSocketStore, useSocketEvent } from '@/store/socketStore';
import { toast } from '@/lib/toast';
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
  FaUserCircle,
  FaFileAlt,
  FaHeadphones,
  FaBolt,
  FaRobot,
  FaShieldAlt,
  FaComments,
  FaUserFriends,
  FaInbox,
  FaFlag,
  FaChartBar,
  FaTag
} from 'react-icons/fa';
import { useAuthStore } from '@/store/authStore';
import FlashLoader from '@/components/ui/FlashLoader';

export default function InboxPage() {
  const workspace = useAuthStore(state => state.workspace);
  const stage1Complete = useAuthStore(state => state.stage1Complete);
  const phoneStatus = useAuthStore(state => state.phoneStatus);
  const bspReady = stage1Complete && ['CONNECTED', 'RESTRICTED'].includes(phoneStatus);
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
  const [typingUsers, setTypingUsers] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const statusCacheRef = useRef({});

  // File upload state
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);

  // CRM State
  const [activeDeal, setActiveDeal] = useState(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [pipelines, setPipelines] = useState([]);

  const { socket, connected } = useSocketStore();

  const [currentView, setCurrentView] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [agents, setAgents] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    tags: true,
    notes: true,
    pipeline: true,
    history: false
  });

  // Interakt alignment state
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [internalNoteMode, setInternalNoteMode] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [contactLabels, setContactLabels] = useState(['General', 'Sales', 'Support', 'Billing', 'VIP', 'Urgent']);
  const [activeFilters, setActiveFilters] = useState({
    label: null,
    status: null,
    assignee: null
  });

  // Load initial data (User & Tags)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [userRes, tagsRes, agentsRes, quickRepliesRes] = await Promise.all([
          get('/auth/me'),
          get('/tags'),
          get('/inbox/agents').catch(() => ({ agents: [] })),
          get('/quick-replies').catch(() => ({ data: [] }))
        ]);
        setCurrentUser(userRes.user || userRes.data || null);
        setAvailableTags(tagsRes.tags || tagsRes.data || []);
        setAgents(agentsRes.agents || agentsRes.data || []);
        setQuickReplies(quickRepliesRes.data || []);
      } catch (err) {
        console.error('Error fetching initial inbox data:', err);
      }
    };
    fetchInitialData();
  }, []);

  // Load conversations on mount or when view/filters change
  useEffect(() => {
    loadConversations();
  }, [currentView, activeFilters]);

  // Listen for real-time message events (Synchronized with backend)
  useSocketEvent('inbox:new-message', (data) => {
    console.log('New message received:', data);

    setConversations(prev => {
      const idx = prev.findIndex(c => String(c._id) === String(data.conversationId) || (c.contact && String(c.contact._id) === String(data.contact._id)));
      if (idx !== -1) {
        const conv = { ...prev[idx] };
        conv.lastMessageAt = data.message.createdAt;
        conv.lastMessage = data.message;
        conv.lastMessagePreview = data.message.body || data.message.type || 'New message';

        // Increase unread count if it's not the currently active conversation
        if (!selectedContact || String(data.contact._id) !== String(selectedContact._id)) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        } else {
          conv.unreadCount = 0;
          conv.myUnreadCount = 0;
        }

        const newConversations = [...prev];
        newConversations.splice(idx, 1);
        return [conv, ...newConversations];
      } else {
        // Fetch conversations once to grab the new fully populated document
        setTimeout(() => loadConversations(), 500);
        return prev;
      }
    });

    // If this message is for the currently selected contact, add it to messages
    if (selectedContact && String(data.contact._id) === String(selectedContact._id)) {
      setMessages(prev => {
        if (prev.some(m => String(m._id) === String(data.message._id))) return prev;
        return [...prev, data.message];
      });
      scrollToBottom();

      // Mark as read immediately since the conversation is open
      if (data.conversationId) {
        post(`/inbox/${data.conversationId}/read`, {}).catch(err => console.error('Failed to mark read:', err));
      }
    }
  });

  useSocketEvent('inbox:new-conversation', (data) => {
    console.log('New conversation received:', data);
    loadConversations();

    if (selectedContact && String(data.contact._id) === String(selectedContact._id)) {
      if (data.firstMessage) {
        setMessages(prev => {
          if (prev.some(m => String(m._id) === String(data.firstMessage._id))) return prev;
          return [...prev, data.firstMessage];
        });
        scrollToBottom();

        // Mark as read immediately
        if (data.conversationId || data.conversation?._id) {
          const cid = data.conversationId || data.conversation._id;
          post(`/inbox/${cid}/read`, {}).catch(err => console.error('Failed to mark read:', err));
        }
      }
    }
  });

  // Listen for message status updates (Synchronized with backend)
  useSocketEvent('inbox:message-status', (data) => {
    console.log('Message status updated:', data);

    // Cache the status in case the POST request hasn't returned yet to prevent race conditions
    if (data.messageId && data.status) {
      statusCacheRef.current[data.messageId] = data.status;
    }

    // Update message status in current thread
    setMessages(prev => prev.map(msg =>
      String(msg._id) === String(data.messageId) ||
        String(msg.whatsappMessageId) === String(data.messageId) ||
        (msg.whatsappMessageId && typeof msg.whatsappMessageId === 'object' && String(msg.whatsappMessageId.id) === String(data.messageId))
        ? { ...msg, status: data.status }
        : msg
    ));

    // Also update in conversations list if it's the last message
    setConversations(prev => prev.map(conv => {
      if (conv.lastMessage && (String(conv.lastMessage._id) === String(data.messageId) || String(conv.lastMessage.whatsappMessageId) === String(data.messageId))) {
        return {
          ...conv,
          lastMessage: { ...conv.lastMessage, status: data.status }
        };
      }
      return conv;
    }));
  });

  // Listen for read synchronizations across devices
  useSocketEvent('conversation:read', (data) => {
    setConversations(prev => prev.map(conv =>
      String(conv._id) === String(data.conversationId)
        ? { ...conv, myUnreadCount: 0, unreadCount: data.unreadCount ?? 0 }
        : conv
    ));
  });

  // Listen for agent typing indicators (via soft lock)
  useSocketEvent('inbox:agent-typing', (data) => {
    if (!data.conversationId) return;
    setTypingUsers(prev => ({
      ...prev,
      [data.conversationId]: {
        isTyping: data.isTyping,
        agentId: data.agentId
      }
    }));

    // Auto-clear typing after 5 seconds
    if (data.isTyping) {
      setTimeout(() => {
        setTypingUsers(current => {
          if (current[data.conversationId]?.agentId === data.agentId) {
            return {
              ...current,
              [data.conversationId]: {
                ...current[data.conversationId],
                isTyping: false
              }
            };
          }
          return current;
        });
      }, 5000);
    }
  });

  // Listen for regular agent typing events over socket
  useSocketEvent('inbox:typing', (data) => {
    if (!data.conversationId || !data.agent) return;
    setTypingUsers(prev => ({
      ...prev,
      [data.conversationId]: {
        isTyping: data.isTyping,
        agentId: data.agent._id || data.agent.id,
        agentName: data.agent.name
      }
    }));

    if (data.isTyping) {
      setTimeout(() => {
        setTypingUsers(current => {
          const agentId = data.agent._id || data.agent.id;
          if (current[data.conversationId]?.agentId === agentId) {
            return {
              ...current,
              [data.conversationId]: {
                ...current[data.conversationId],
                isTyping: false
              }
            };
          }
          return current;
        });
      }, 3000);
    }
  });

  const loadConversations = async () => {
    try {
      setLoading(true);
      let filterQuery = '';
      if (activeFilters.label) filterQuery += `&label=${encodeURIComponent(activeFilters.label)}`;
      if (activeFilters.status) filterQuery += `&status=${activeFilters.status}`;
      if (activeFilters.assignee) filterQuery += `&assignee=${activeFilters.assignee}`;

      const response = await get(`/inbox?view=${currentView}&limit=100${filterQuery}`);
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

    // Clear unread counts natively upon viewing
    setConversations(prev => prev.map(c =>
      (c._id || c.id) === (conversation._id || conversation.id)
        ? { ...c, unreadCount: 0, myUnreadCount: 0 }
        : c
    ));

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

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit (e.g., 16MB for WhatsApp typical)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('File size too large. Maximum size is 16MB.');
      return;
    }

    setSelectedMedia(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview({
      url: objectUrl,
      type: file.type,
      name: file.name
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = null; // reset input
    }
  };

  const handleAssignConversation = async (agentId) => {
    if (!selectedConversationId) return;
    try {
      if (!agentId) {
        await post(`/inbox/${selectedConversationId}/unassign`);
        toast.info('Conversation unassigned');
      } else {
        await post(`/inbox/${selectedConversationId}/assign`, { agentId });
        const agentName = agents.find(a => a._id === agentId)?.name || 'agent';
        toast.success(`Assigned to ${agentName}`);
      }
      loadConversations();
    } catch (error) {
      console.error('Error assigning conversation:', error);
      toast.error('Assignment failed');
    }
  };

  const handleResolveConversation = async () => {
    if (!selectedConversationId) return;
    try {
      setSending(true);
      await post(`/inbox/${selectedConversationId}/close`, { resolution: 'Resolved manually' });
      toast.success('Conversation resolved');
      setSelectedContact(null);
      setSelectedConversationId(null);
      loadConversations();
    } catch (error) {
      console.error('Error resolving conversation:', error);
      toast.error('Failed to resolve conversation');
    } finally {
      setSending(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleAddTag = async (tagName) => {
    if (!selectedConversationId) return;
    try {
      await post(`/conversations/${selectedConversationId}/tags`, { tags: [tagName] });
      toast.success(`Tag "${tagName}" added`);
      // Update local contact state if needed, or reload messages/convs
      loadConversations();
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
    }
  };

  const handleSetLabel = async (label) => {
    if (!selectedConversationId) return;
    try {
      await put(`/inbox/${selectedConversationId}/label`, { label });
      toast.success(`Label set to ${label}`);
      setShowLabelModal(false);
      loadConversations();
    } catch (error) {
      toast.error('Failed to set label');
    }
  };

  const handleClearLabel = async () => {
    if (!selectedConversationId) return;
    try {
      await del(`/inbox/${selectedConversationId}/label`);
      toast.success('Label cleared');
      loadConversations();
    } catch (error) {
      toast.error('Failed to clear label');
    }
  };

  const handleMarkSpam = async () => {
    if (!selectedConversationId) return;
    try {
      await post(`/inbox/${selectedConversationId}/spam`);
      toast.success('Marked as spam');
      setSelectedContact(null);
      setSelectedConversationId(null);
      loadConversations();
    } catch (error) {
      toast.error('Failed to mark as spam');
    }
  };

  const handleUnmarkSpam = async () => {
    if (!selectedConversationId) return;
    try {
      await del(`/inbox/${selectedConversationId}/spam`);
      toast.success('Unmarked as spam');
      loadConversations();
    } catch (error) {
      toast.error('Failed to unmark spam');
    }
  };

  const handleSelectQuickReply = (reply) => {
    let content = reply.content;
    // Basic variable replacement
    if (selectedContact) {
      content = content.replace(/\{\{name\}\}/gi, selectedContact.name || 'Customer');
      content = content.replace(/\{\{phone\}\}/gi, selectedContact.phone || '');
    }
    setNewMessage(content);
    setShowQuickReplies(false);
  };

  const handleRemoveTag = async (tagName) => {
    if (!selectedConversationId) return;
    try {
      await del(`/conversations/${selectedConversationId}/tags`, { tags: [tagName] });
      toast.success(`Tag "${tagName}" removed`);
      loadConversations();
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
    }
  };

  const clearSelectedMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (!selectedConversationId || !socket) return;

    // Emit typing via socket
    if (!typingTimeoutRef.current) {
      socket.emit('typing', {
        conversationId: selectedConversationId,
        isTyping: true
      });
    } else {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', {
        conversationId: selectedConversationId
      });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();

    if (!newMessage.trim() && !selectedMedia) return;
    if (!selectedContact) return;

    if (!bspReady) {
      toast?.error?.('Connect WhatsApp to send messages') || alert('Connect WhatsApp to send messages');
      return;
    }

    // --- Flow for sending Media ---
    if (selectedMedia) {
      const savedMedia = selectedMedia;
      const captionText = newMessage.trim();
      const savedPreview = mediaPreview?.url || null;
      const conversationId = selectedConversationId;

      let mediaType = 'document';
      const mt = savedMedia.type || '';
      if (mt.startsWith('image/')) mediaType = 'image';
      else if (mt.startsWith('video/')) mediaType = 'video';
      else if (mt.startsWith('audio/')) mediaType = 'audio';

      const tmpId = `tmp-${Date.now()}`;
      const optimisticMessage = {
        _id: tmpId,
        type: mediaType,
        body: captionText || (mediaType === 'document' ? savedMedia.name : ''),
        direction: 'outbound',
        status: 'queued',
        createdAt: new Date().toISOString(),
        contact: selectedContact._id,
        media: {
          url: savedPreview,
          link: savedPreview,
          filename: savedMedia.name,
          caption: captionText
        }
      };

      setMessages(prev => [...prev, optimisticMessage]);
      clearSelectedMedia();
      setNewMessage('');
      scrollToBottom();

      try {
        const uploadRes = await uploadInboxMedia(savedMedia);

        if (uploadRes.success) {
          if (conversationId) {
            const messageRes = await post(`/inbox/${conversationId}/messages/media`, {
              mediaUrl: uploadRes.url,
              mediaType: mediaType,
              caption: captionText,
              filename: uploadRes.filename || savedMedia.name
            });

            if (messageRes.success) {
              let finalMsg = null;
              if (messageRes.data?.message) {
                finalMsg = messageRes.data.message;
              } else if (messageRes.result?.message) {
                finalMsg = messageRes.result.message;
              } else if (messageRes.result) {
                finalMsg = messageRes.result;
              } else if (messageRes.message && typeof messageRes.message === 'object') {
                finalMsg = messageRes.message;
              }

              if (finalMsg && typeof finalMsg === 'object') {
                const finalWamId = typeof finalMsg.whatsappMessageId === 'object' ? finalMsg.whatsappMessageId.id : finalMsg.whatsappMessageId;
                const cachedStatus = statusCacheRef.current[finalMsg._id] || statusCacheRef.current[finalWamId];
                const realStatus = cachedStatus || finalMsg.status || 'sent';
                setMessages(prev => prev.map(m => m._id === tmpId ? { ...finalMsg, status: realStatus } : m));
              } else {
                setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'sent' } : m));
              }
            } else {
              setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
            }
          } else {
            // Handle sending to a contact without an active DB conversation ID yet
            const dataPayload = {
              contactId: selectedContact._id,
              type: mediaType,
              mediaUrl: uploadRes.url,
              filename: uploadRes.filename || savedMedia.name,
              caption: captionText
            };
            const messageRes = await post('/messages/send', dataPayload);
            if (messageRes.success) {
              let finalMsg = null;
              if (messageRes.data?.message) {
                finalMsg = messageRes.data.message;
              } else if (messageRes.result?.message) {
                finalMsg = messageRes.result.message;
              } else if (messageRes.result) {
                finalMsg = messageRes.result;
              } else if (messageRes.message && typeof messageRes.message === 'object') {
                finalMsg = messageRes.message;
              }

              if (finalMsg && typeof finalMsg === 'object') {
                const finalWamId = typeof finalMsg.whatsappMessageId === 'object' ? finalMsg.whatsappMessageId.id : finalMsg.whatsappMessageId;
                const cachedStatus = statusCacheRef.current[finalMsg._id] || statusCacheRef.current[finalWamId];
                const realStatus = cachedStatus || finalMsg.status || 'sent';
                setMessages(prev => prev.map(m => m._id === tmpId ? { ...finalMsg, status: realStatus } : m));
              } else {
                setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'sent' } : m));
              }
            } else {
              setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
            }
          }
          // Optional: toast.success('Media sent successfully');
          loadConversations();
        } else {
          setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
          toast.error(uploadRes.message || 'Media upload failed');
        }
      } catch (err) {
        console.error('[INBOX] Media send error:', err);
        setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
        toast.error('Failed to send media');
      }
      return;
    }

    // --- Flow for handling text messages ---
    const textToSend = newMessage.trim();
    const contactId = selectedContact._id || selectedContact.id;
    const conversationId = selectedConversationId;
    const tmpId = `tmp-${Date.now()}`;

    // Optimistically add message to UI immediately
    const optimisticMessage = {
      _id: tmpId,
      body: textToSend,
      direction: 'outbound',
      status: 'queued',
      createdAt: new Date().toISOString(),
      contact: contactId
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    scrollToBottom();

    try {
      let data;
      if (conversationId) {
        data = await post(`/inbox/${conversationId}/messages`, {
          text: textToSend
        });
      } else {
        data = await post('/messages/send', {
          contactId: contactId,
          phone: selectedContact.phone,
          name: selectedContact.name,
          body: textToSend
        });
      }

      // Try multiple payload structures depending on which endpoint was hit
      let sentMessage = null;
      if (data?.data?.message) {
        sentMessage = data.data.message;
      } else if (data?.result?.message) {
        sentMessage = data.result.message;
      } else if (data?.result) {
        sentMessage = data.result;
      } else if (data?.message && typeof data.message === 'object') {
        sentMessage = data.message;
      }

      if (data?.success || sentMessage) {
        // Ensure sentMessage has whatsappMessageId properly mapped
        if (sentMessage && !sentMessage.whatsappMessageId && sentMessage.messageId) {
          sentMessage.whatsappMessageId = sentMessage.messageId;
        }

        const wamIdToCache = sentMessage ? (typeof sentMessage.whatsappMessageId === 'object' ? sentMessage.whatsappMessageId.id : sentMessage.whatsappMessageId) : null;
        const cachedStatus = sentMessage ? (statusCacheRef.current[sentMessage._id] || statusCacheRef.current[wamIdToCache]) : null;
        const realStatus = cachedStatus || sentMessage?.status || 'sent';

        setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, ...sentMessage, status: realStatus, whatsappMessageId: wamIdToCache } : m));
        loadConversations();

        if (data?.data?.fallbackUsed) {
          const templateName = data?.data?.fallbackTemplateName;
          toast?.success?.(templateName
            ? `24h window was closed, sent template: ${templateName}`
            : '24h window was closed, sent fallback template');
        }
      } else {
        setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
      toast?.error?.(error.message || 'Failed to send message');
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
  const selectedConversation = conversations.find(c => (c._id || c.id) === selectedConversationId);

  return (
    <div className="fixed top-[60px] left-0 lg:left-[72px] right-0 bottom-0 bg-background text-foreground font-sans overflow-hidden flex z-20 transition-all duration-300">
      <div className="w-[300px] lg:w-[340px] flex-shrink-0 border-r border-border bg-card flex flex-col z-10">
        {/* Sidebar Header: Interakt style View Switcher */}


        {/* Search Bar */}
        <div className="px-4 py-3 bg-card">
          <div className="relative bg-muted rounded-lg flex items-center px-3 py-2 border border-transparent focus-within:border-primary focus-within:bg-card transition-all">
            <FaSearch className="text-muted-foreground text-sm flex-shrink-0" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none text-[13px] text-foreground placeholder:text-muted-foreground outline-none font-medium h-6 ml-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/inbox/analytics"
              className="p-2.5 bg-card border border-border text-muted-foreground hover:text-primary rounded-xl hover:bg-primary/10 shadow-sm transition-all"
              title="Inbox Analytics"
            >
              <FaChartBar size={16} />
            </Link>

            <button
              onClick={() => setStartModalOpen(true)}
              className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:brightness-110 shadow-sm hover:shadow-md transition-all active:scale-95"
              title="Start New Conversation"
            >
              <FaPlus size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-2 mb-2">
          {['all', 'mine', 'unassigned'].map(view => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize transition-all ${currentView === view
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Socket Status */}
        <div className="px-4 py-1 text-[11px] font-medium flex items-center gap-1.5 border-b border-border">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-muted-foreground">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <FlashLoader />
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
              <FaArchive className="text-4xl mb-3 opacity-50" />
              <p className="text-sm font-medium">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conversation, idx) => (
              <div
                key={conversation._id || conversation.id || `conv-${idx}`}
                onClick={() => handleSelectContact(conversation)}
                className={`px-4 py-3 border-b-0 cursor-pointer transition-all flex items-start gap-4 mx-2 my-1 rounded-xl ${selectedContact?._id === conversation.contact._id
                  ? 'bg-primary/5 shadow-sm border border-primary/20'
                  : 'bg-card hover:bg-muted border border-transparent hover:border-border'
                  }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0 pt-1">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center overflow-hidden border-2 ${selectedContact?._id === conversation.contact._id ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'}`}>
                    <FaUser className="text-lg" />
                  </div>
                </div>

                {/* Chat Preview */}
                <div className="flex-1 min-w-0 pr-1 py-1">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`font-semibold truncate text-[15px] ${selectedContact?._id === conversation.contact._id ? 'text-primary' : 'text-foreground'}`}>
                      {conversation.contact?.displayName || conversation.contact?.name || conversation.contact?.phone}
                    </h3>
                    {conversation.lastMessageAt && (
                      <span className={`text-[11px] flex-shrink-0 ml-2 font-medium ${selectedContact?._id === conversation.contact._id ? 'text-primary' : 'text-muted-foreground'}`}>
                        {new Date(conversation.lastMessageAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-[13px] text-muted-foreground truncate pr-2">
                      {typingUsers[conversation._id]?.isTyping && typingUsers[conversation._id]?.agentId !== currentUser?._id ? (
                        <span className="text-primary italic font-medium">Typing...</span>
                      ) : (
                        conversation.lastMessage?.body || conversation.lastMessagePreview || 'No messages'
                      )}
                    </p>
                    {(conversation.myUnreadCount || conversation.unreadCount || 0) > 0 && (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-[10px] font-bold flex-shrink-0">
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
      <div className="flex-1 flex flex-col bg-muted/20 relative border-r border-border shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
        {!workspace?.loading && !bspReady && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <FaInfoCircle />
              <p className="text-sm font-medium">WhatsApp not connected. Connect account to send messages.</p>
            </div>
            <button
              onClick={() => (window.location.href = '/dashboard?connectWhatsApp=1')}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              Connect App
            </button>
          </div>
        )}

        {selectedContact ? (
          <>
            {/* Chat Thread Header */}
            <div className={`px-5 py-3 bg-card border-b border-border flex items-center justify-between shadow-sm z-10 ${!bspReady ? 'mt-10' : ''}`}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border border-primary/20">
                    {selectedContact.avatarUrl || selectedContact.avatar ? (
                      <img src={selectedContact.avatarUrl || selectedContact.avatar} alt={selectedContact.name} className="w-full h-full object-cover" />
                    ) : (
                      <FaUser className="text-primary/60 text-lg" />
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full"></div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-foreground text-[15px] leading-tight">
                      {selectedContact.displayName || selectedContact.name || selectedContact.phone}
                    </h2>
                    {selectedConversation?.label && (
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-bold tracking-wide uppercase">
                        {selectedConversation.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {typingUsers[selectedConversationId]?.isTyping && typingUsers[selectedConversationId]?.agentId !== currentUser?._id ? (
                      <span className="text-primary animate-pulse font-medium">Typing...</span>
                    ) : (
                      selectedContact.phone
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Add Label Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowLabelModal(!showLabelModal)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-semibold ${selectedConversation?.label ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    <FaFlag size={10} />
                    <span>{selectedConversation?.label || 'Add Label'}</span>
                  </button>

                  {showLabelModal && (
                    <div className="absolute top-full mt-2 right-0 w-48 bg-popover border border-border rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 py-1.5 border-b border-border/50 mb-1">Select Label</p>
                      {contactLabels.map((l, idx) => (
                        <button
                          key={l || `label-${idx}`}
                          onClick={() => handleSetLabel(l)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedConversation?.label === l ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground/80'}`}
                        >
                          {l}
                        </button>
                      ))}
                      {selectedConversation?.label && (
                        <button
                          onClick={handleClearLabel}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 mt-1 transition-colors border-t border-border/50"
                        >
                          Clear Label
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg bg-muted/50">
                  <FaUserCircle className="text-muted-foreground" />
                  <select
                    value={selectedConversation?.assignedTo?._id || selectedConversation?.assignedTo || ''}
                    onChange={(e) => handleAssignConversation(e.target.value)}
                    className="bg-transparent border-none text-[13px] font-medium text-foreground outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent, idx) => (
                      <option key={agent._id || `agent-${idx}`} value={agent._id}>
                        {agent.name === currentUser?.name ? 'Assigned to Me' : agent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-px h-6 bg-border mx-1 hidden md:block"></div>

                <button
                  onClick={handleResolveConversation}
                  disabled={sending}
                  className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all shadow-sm"
                  title="Resolve Chat"
                >
                  {sending ? <FaSpinner className="animate-spin text-sm" /> : <FaCheck className="text-sm" />}
                </button>

                <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                  <FaEllipsisV className="text-sm" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative bg-background/50"
            >
              {messages.map((message) => {
                const isOutbound = message.direction === 'outbound';
                const isTemplate = message.type === 'template';
                const hideBodyText = !message.body || message.body === `[${message.type}]` || message.body === '[template]' || (['image', 'video', 'document', 'audio', 'sticker', 'location'].includes(message.type) && message.body === `[${message.type}]`);

                let templateHeaderFormat = message.template?.header?.format || null;
                let templateHeaderMediaUrl = message.template?.header?.mediaUrl || null;
                let templateHeaderFilename = "Document";

                if (isTemplate && message.meta?.components) {
                  const headerComponent = message.meta.components.find(c => c.type === 'header');
                  if (headerComponent && headerComponent.parameters?.length > 0) {
                    const p = headerComponent.parameters[0];
                    if (p.type === 'image' && p.image?.link) {
                      templateHeaderFormat = 'IMAGE';
                      templateHeaderMediaUrl = p.image.link;
                    } else if (p.type === 'video' && p.video?.link) {
                      templateHeaderFormat = 'VIDEO';
                      templateHeaderMediaUrl = p.video.link;
                    } else if (p.type === 'document' && p.document?.link) {
                      templateHeaderFormat = 'DOCUMENT';
                      templateHeaderMediaUrl = p.document.link;
                      templateHeaderFilename = p.document.filename || "Document";
                    }
                  }
                }

                return (
                  <div key={message._id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} w-full`}>
                    <div
                      className={`relative max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] px-1 pt-1 pb-1 shadow-sm border ${isOutbound
                        ? 'bg-emerald-500/15 dark:bg-emerald-900/40 border-emerald-500/10 rounded-2xl rounded-tr-sm'
                        : 'bg-card border-border rounded-2xl rounded-tl-sm'
                        }`}
                    >
                      {/* Removed triangle tail for modern SaaS look */}

                      {/* Header Media */}
                      {templateHeaderFormat === 'IMAGE' && templateHeaderMediaUrl && (
                        <div className="p-1 pb-0">
                          <div className="relative w-full overflow-hidden rounded-lg bg-muted/50">
                            <img
                              src={templateHeaderMediaUrl}
                              alt="Image"
                              className="w-full h-auto max-h-[250px] object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                        </div>
                      )}

                      {templateHeaderFormat === 'VIDEO' && templateHeaderMediaUrl && (
                        <div className="p-1 pb-0">
                          <div className="relative w-full aspect-video bg-black rounded-md flex items-center justify-center overflow-hidden group border border-black/10">
                            <video src={templateHeaderMediaUrl} className="w-full h-full object-cover" controls />
                          </div>
                        </div>
                      )}

                      {templateHeaderFormat === 'DOCUMENT' && templateHeaderMediaUrl && (
                        <a href={templateHeaderMediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-muted rounded-md hover:bg-muted/80 transition mt-1 mx-1">
                          <FaFileAlt className="text-muted-foreground text-2xl" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground font-medium truncate">{templateHeaderFilename}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">Click to view/download</p>
                          </div>
                        </a>
                      )}

                      {/* Generic Media (Non-Template) */}
                      {['image', 'video', 'document', 'audio', 'sticker'].includes(message.type) && (message.media?.url || message.media?.link || message.meta?.media?.url || message.meta?.media?.link) && (
                        <div className="p-1 pb-0">
                          {['image', 'sticker'].includes(message.type) && (
                            <div className="relative w-full overflow-hidden rounded-lg bg-muted/50">
                              <img
                                src={message.media?.url || message.media?.link || message.meta?.media?.url || message.meta?.media?.link}
                                alt={message.media?.caption || message.meta?.media?.caption || 'Image'}
                                className="w-full h-auto max-h-[250px] object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}
                          {message.type === 'video' && (
                            <div className="relative w-full aspect-video bg-black rounded-md flex items-center justify-center overflow-hidden group border border-black/10">
                              <video src={message.media?.url || message.media?.link || message.meta?.media?.url || message.meta?.media?.link} controls className="w-full h-full object-cover" />
                            </div>
                          )}
                          {message.type === 'document' && (
                            <a href={message.media?.url || message.media?.link || message.meta?.media?.url || message.meta?.media?.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-muted rounded-md hover:bg-muted/80 transition mt-1 mx-1">
                              <FaFileAlt className="text-muted-foreground text-2xl" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground font-medium truncate">{message.media?.filename || message.meta?.media?.filename || 'Document'}</p>
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">Click to view/download</p>
                              </div>
                            </a>
                          )}
                          {message.type === 'audio' && (
                            <div className="px-1 py-2">
                              <audio src={message.media?.url || message.media?.link || message.meta?.media?.url || message.meta?.media?.link} controls className="w-full max-w-[250px] h-10" />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="p-2 pt-1.5 px-2.5 pb-2 flow-root">
                        {isTemplate && isOutbound && (
                          <div className="mb-1 flex items-center justify-between gap-2 border-b border-border/50 pb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                              <FaInfoCircle /> Template
                            </span>
                          </div>
                        )}

                        {!hideBodyText && (
                          <div className="text-[14.5px] leading-[1.35] text-foreground whitespace-pre-wrap font-normal drop-words">
                            {message.body}
                          </div>
                        )}

                        {/* Timestamp & Status */}
                        <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 float-right clear-both
                          ${(!hideBodyText && message.body && message.body.length >= 30) ? 'w-full' : 'ml-4'}`}
                        >
                          <span className="text-[10.5px] text-muted-foreground opacity-90 relative top-[1px]">
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
                        <div className="flex flex-col border-t border-border/50 mt-1">
                          {message.template.buttons.map((btn, idx) => (
                            <button
                              key={idx}
                              className="w-full py-3 px-3 text-[14px] leading-tight font-medium text-emerald-500 flex justify-center items-center gap-2 border-b border-border/50 last:border-b-0 hover:bg-muted transition-colors whitespace-nowrap"
                              onClick={() => {
                                if (btn.type === 'URL' && btn.url) window.open(btn.url, '_blank');
                                if (btn.type === 'PHONE_NUMBER' && btn.phoneNumber) window.location.href = `tel:${btn.phoneNumber}`;
                              }}
                            >
                              {btn.type === 'URL' && <FaExternalLinkAlt className="text-[12px]" />}
                              {btn.type === 'PHONE_NUMBER' && <FaPhoneAlt className="text-[12px]" />}
                              <span className="truncate">{btn.text}</span>
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

            {/* Compose Input Box: Interakt style */}
            <div className={`p-4 flex flex-col gap-2 border-t border-border z-10 w-full relative drop-shadow-[0_-4px_10px_rgba(0,0,0,0.02)] transition-colors ${internalNoteMode ? 'bg-amber-500/5' : 'bg-card'}`}>

              {/* Internal Note / Message Toggle */}
              <div className="flex items-center gap-1 px-1">
                <button
                  onClick={() => setInternalNoteMode(false)}
                  className={`px-3 py-1 rounded-t-lg text-[11px] font-bold uppercase tracking-wider transition-all ${!internalNoteMode ? 'bg-card border-x border-t border-border text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <FaComments className="inline-block mr-1 mb-0.5" /> Message
                </button>
                <button
                  onClick={() => setInternalNoteMode(true)}
                  className={`px-3 py-1 rounded-t-lg text-[11px] font-bold uppercase tracking-wider transition-all ${internalNoteMode ? 'bg-amber-500/10 border-x border-t border-amber-500/20 text-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <FaFlag className="inline-block mr-1 mb-0.5" /> Internal Note
                </button>
              </div>

              <div className="flex items-end gap-3 w-full">
                {/* Media Preview Overlay */}
                {mediaPreview && (
                  <div className="absolute bottom-[calc(100%+8px)] left-4 p-2 bg-popover rounded-xl shadow-[0_-4px_15px_rgba(0,0,0,0.05)] border border-border z-20 flex animate-fadeIn max-w-[250px]">
                    <div className="relative inline-block w-full">
                      <button
                        onClick={clearSelectedMedia}
                        className="absolute -top-3 -right-3 bg-muted-foreground text-card rounded-full p-1.5 hover:bg-foreground z-10 transition-colors shadow-lg"
                        title="Remove Media"
                      >
                        <FaTimes className="text-[10px]" />
                      </button>
                      {mediaPreview.type.startsWith('image/') ? (
                        <img src={mediaPreview.url} alt="preview" className="h-32 w-full object-cover rounded-lg border border-border" />
                      ) : mediaPreview.type.startsWith('video/') ? (
                        <video src={mediaPreview.url} className="h-32 w-full object-cover rounded-lg border border-border" controls />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 h-32 w-full bg-muted rounded-lg text-muted-foreground border border-border">
                          <FaFileAlt className="text-4xl mb-3 text-primary" />
                          <span className="text-xs text-center truncate w-full px-2 font-medium" title={mediaPreview.name}>
                            {mediaPreview.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 mb-0.5 relative">
                  <button type="button" className="p-2 text-muted-foreground hover:text-primary transition-colors bg-card rounded-full border border-border hover:bg-muted">
                    <FaSmile className="text-lg" />
                  </button>
                  <button
                    type="button"
                    className={`p-2 transition-colors rounded-full border ${selectedMedia ? 'text-primary bg-primary/10 border-primary/20' : isUploading ? 'text-primary bg-primary/10 animate-pulse border-primary/20' : 'text-muted-foreground bg-card hover:text-primary hover:bg-muted border-border'}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <FaPaperclip className="text-lg" />
                  </button>

                  {/* Quick Reply Bolt */}
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className={`p-2 transition-colors rounded-full border ${showQuickReplies ? 'text-primary bg-primary/10 border-primary/20 shadow-inner' : 'text-muted-foreground bg-card hover:text-primary hover:bg-muted border-border'}`}
                  >
                    <FaBolt className="text-lg" />
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleMediaSelect}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                  />

                  {/* Quick Replies Overlay */}
                  {showQuickReplies && (
                    <div className="absolute bottom-full mb-3 left-0 w-72 bg-popover border border-border rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col font-sans">
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.1em] px-2 py-2 border-b border-border/50 flex items-center justify-between">
                        Quick Replies
                        <span className="text-[9px] font-normal lowercase tracking-normal">({quickReplies.length})</span>
                      </p>
                      <div className="max-h-60 overflow-y-auto mt-1 custom-scrollbar">
                        {quickReplies.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-muted-foreground text-center">No quick replies found. Add them in settings.</p>
                        ) : (
                          quickReplies.map((reply, idx) => (
                            <button
                              key={reply._id || `reply-${idx}`}
                              onClick={() => handleSelectQuickReply(reply)}
                              className="w-full text-left px-3 py-2.5 hover:bg-muted rounded-lg group transition-all"
                            >
                              <p className="text-xs font-bold text-foreground group-hover:text-primary">{reply.name}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 group-hover:text-primary/70">{reply.content}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`flex-1 rounded-2xl shadow-sm border transition-all overflow-hidden relative ${internalNoteMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted border-border focus-within:border-primary/50 focus-within:bg-card'}`}>
                  <textarea
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newMessage.trim() || selectedMedia) handleSendMessage(e);
                      }
                    }}
                    placeholder={internalNoteMode ? "Add a private note for the team..." : "Type a message..."}
                    className="w-full max-h-32 min-h-[44px] bg-transparent border-none py-3 px-4 text-[15px] focus:ring-0 resize-none text-foreground placeholder:text-muted-foreground block"
                    rows={1}
                    disabled={sending}
                  />
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!bspReady || sending || (!newMessage.trim() && !selectedMedia)}
                  className={`p-3 rounded-full flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${internalNoteMode
                    ? (newMessage.trim() ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md' : 'bg-muted text-muted-foreground cursor-not-allowed')
                    : ((newMessage.trim() || selectedMedia) && !sending && bspReady
                      ? 'bg-primary hover:brightness-110 text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground cursor-not-allowed')
                    }`}
                >
                  {sending ? <FaSpinner className="animate-spin text-lg" /> : <FaPaperPlane className="text-lg translate-x-[-1px] translate-y-[1px]" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/30 border-l border-border">
            <div className="w-[320px] text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-6 shadow-sm border border-border text-primary">
                <FaPaperPlane className="text-4xl translate-x-[-2px] translate-y-[2px]" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight">Shared Inbox</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
                Select a conversation from the left menu to start messaging, or start a new chat above.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Sidebar: Context Panel (Smart Card / Details) */}
      {selectedContact && (
        <div className="w-[300px] lg:w-[330px] flex-shrink-0 bg-card border-l border-border flex flex-col overflow-y-auto z-30 hidden xl:flex shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.02)] transition-all">

          {/* Contact Header Card */}
          <div className="p-8 flex flex-col items-center justify-center bg-card border-b border-border text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-br from-primary/5 to-primary/10 opacity-80"></div>
            <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mb-3 overflow-hidden border-[3px] border-background shadow-md relative z-10 text-muted-foreground">
              {selectedContact.avatarUrl || selectedContact.avatar ? (
                <img src={selectedContact.avatarUrl || selectedContact.avatar} alt={selectedContact.name} className="w-full h-full object-cover" />
              ) : (
                <FaUserCircle className="text-[80px] text-muted-foreground/30" />
              )}
            </div>
            <h2 className="text-[18px] font-bold text-foreground mb-0.5 relative z-10 mt-1">
              {selectedContact.name || selectedContact.phone}
            </h2>
            <p className="text-[13px] text-muted-foreground font-medium tracking-wide relative z-10">
              {selectedContact.phone}
            </p>
          </div>

          {/* Smart Cards Section */}
          <div className="p-0 flex-1 bg-card">
            {/* Personal Details Card */}
            <div className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleSection('details')}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted transition-colors text-foreground font-bold group"
              >
                <span className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <FaInfoCircle size={14} />
                  </div>
                  Personal Details
                </span>
                <FaChevronDown className={`text-xs text-muted-foreground transition-transform duration-200 ${expandedSections.details ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.details && (
                <div className="px-5 pb-5 text-sm text-foreground bg-card animate-in slide-in-from-top-1 duration-200">
                  <div className="space-y-4">
                    <div className="group/field">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Email</label>
                      <p className="text-xs font-medium text-foreground bg-muted px-3 py-2 rounded-lg border border-transparent hover:border-border transition-all">
                        {selectedContact.email || '—'}
                      </p>
                    </div>
                    <div className="group/field">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Company</label>
                      <input
                        type="text"
                        placeholder="Add company..."
                        className="w-full bg-muted border-none rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tags Card */}
            <div className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleSection('tags')}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted transition-colors text-foreground font-bold group"
              >
                <span className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                    <FaTag size={14} />
                  </div>
                  Customer Tags
                </span>
                <FaChevronDown className={`text-xs text-muted-foreground transition-transform duration-200 ${expandedSections.tags ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.tags && (
                <div className="px-5 pb-5 text-sm bg-card">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedContact.tags?.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 bg-muted text-foreground rounded-md text-[11px] font-bold flex items-center gap-1.5 group/tag border border-border">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <FaPlus className="rotate-45 text-[10px]" />
                        </button>
                      </span>
                    ))}
                    {(!selectedContact.tags || selectedContact.tags.length === 0) && (
                      <span className="text-xs text-muted-foreground italic">No tags added yet.</span>
                    )}
                  </div>

                  <div className="relative group/search">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within/search:text-primary transition-colors" size={10} />
                    <input
                      type="text"
                      placeholder="Add tag (e.g. High Priority)"
                      className="w-full pl-8 pr-3 py-2 bg-muted border-none rounded-lg text-xs focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag(e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Internal Notes Card */}
            <div className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleSection('notes')}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted transition-colors text-foreground font-bold group"
              >
                <span className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                    <FaFlag size={14} />
                  </div>
                  Team Notes
                </span>
                <FaChevronDown className={`text-xs text-muted-foreground transition-transform duration-200 ${expandedSections.notes ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.notes && (
                <div className="px-5 pb-5 text-sm bg-card">
                  <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
                    {/* Placeholder for notes */}
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                      <p className="text-[11px] text-amber-600/90 leading-normal font-medium">Customer requested callback tomorrow at 3 PM.</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-amber-600/70 font-bold uppercase">System</span>
                        <span className="text-[9px] text-amber-600/50 italic">Generated</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setInternalNoteMode(true)}
                    className="w-full py-2 bg-amber-500/10 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-500/20 transition-colors border border-amber-500/20 border-dashed"
                  >
                    + Add New Note
                  </button>
                </div>
              )}
            </div>

            {/* Interaction History Card */}
            <div className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleSection('history')}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted transition-colors text-foreground font-bold group"
              >
                <span className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-muted text-muted-foreground rounded-lg group-hover:bg-accent transition-colors">
                    <FaClock size={14} />
                  </div>
                  Interaction History
                </span>
                <FaChevronDown className={`text-xs text-muted-foreground transition-transform duration-200 ${expandedSections.history ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.history && (
                <div className="px-5 pb-8 text-sm bg-card">
                  <div className="space-y-4 relative before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
                    <div className="relative pl-6">
                      <div className="absolute left-0 top-1 w-3 h-3 bg-card border-2 border-emerald-500 rounded-full z-10"></div>
                      <p className="text-[11px] font-bold text-foreground">Current Session Active</p>
                      <p className="text-[10px] text-muted-foreground">Inbound Message Recieved</p>
                    </div>
                    <div className="relative pl-6">
                      <div className="absolute left-0 top-1 w-3 h-3 bg-card border-2 border-border rounded-full z-10"></div>
                      <p className="text-[11px] font-bold text-foreground">Contact Created</p>
                      <p className="text-[10px] text-muted-foreground">First Interaction</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Start Conversation Modal */}
      {startModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-border">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/50">
              <h3 className="text-lg font-bold text-foreground">Start New Conversation</h3>
              <button
                onClick={() => setStartModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-full transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto bg-card">
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-2">Select Contact</label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => handleSearchStartContacts(e.target.value)}
                    placeholder="Search by name or phone"
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg bg-muted/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm text-foreground transition-all"
                  />
                </div>

                <div className="mt-3 max-h-48 overflow-y-auto border border-border rounded-lg shadow-inner bg-muted/30">
                  {contactOptions.length > 0 ? (
                    contactOptions.map((contact, idx) => (
                      <button
                        key={contact._id || `opt-${idx}`}
                        type="button"
                        onClick={() => setSelectedStartContact(contact)}
                        className={`w-full text-left px-4 py-3 border-b last:border-b-0 border-border transition-colors flex justify-between items-center ${selectedStartContact?._id === contact._id
                          ? 'bg-primary/10 border-primary/20'
                          : 'hover:bg-muted bg-transparent'
                          }`}
                      >
                        <div>
                          <p className={`font-semibold text-sm ${selectedStartContact?._id === contact._id ? 'text-primary' : 'text-foreground'}`}>
                            {contact.name || contact.phone}
                          </p>
                          {contact.name && (
                            <p className="text-xs text-muted-foreground mt-0.5">{contact.phone}</p>
                          )}
                        </div>
                        {selectedStartContact?._id === contact._id && (
                          <FaCheckCircle className="text-primary" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground bg-card">
                      No contacts found. Please add a contact in the Sales CRM tab first.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-2">First Message</label>
                <textarea
                  value={startMessage}
                  onChange={(e) => setStartMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 border border-border rounded-lg bg-muted/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm text-foreground transition-all resize-none placeholder:text-muted-foreground"
                />
                <div className="flex items-start gap-2 mt-2 px-1">
                  <FaInfoCircle className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-500/80 leading-snug">
                    Sending a message to a new contact outside the 24h window will use standard template pricing.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border flex justify-end gap-3 bg-muted/50">
              <button
                onClick={() => setStartModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartConversation}
                disabled={startingConversation || !selectedStartContact || !startMessage.trim()}
                className="px-6 py-2 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110 focus:ring-4 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
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
