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
  FaInfoCircle
} from 'react-icons/fa';
import ConversationsSidebar from '@/components/dashboard/inbox/ConversationsSidebar';
import MessageThread from '@/components/dashboard/inbox/MessageThread';
import ChatInput from '@/components/dashboard/inbox/ChatInput';
import ContactDetailsSidebar from '@/components/dashboard/inbox/ContactDetailsSidebar';
import StartConversationModal from '@/components/dashboard/inbox/StartConversationModal';
import TemplateSelectorModal from '@/components/dashboard/inbox/TemplateSelectorModal';
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
  const [showTemplateModal, setShowTemplateModal] = useState(false);
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
    details: false,
    tags: false,
    notes: false,
    pipeline: false,
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

    // --- Flow for handling internal notes ---
    if (internalNoteMode) {
      const textToSend = newMessage.trim();
      const conversationId = selectedConversationId;
      const tmpId = `tmp-note-${Date.now()}`;

      // Optimistic note update
      const optimisticNote = {
        _id: tmpId,
        body: textToSend,
        direction: 'outbound',
        type: 'note',
        isInternalNote: true,
        status: 'received',
        createdAt: new Date().toISOString(),
        sentBy: currentUser || { _id: 'me', name: 'Me' }
      };

      setMessages(prev => [...prev, optimisticNote]);
      setNewMessage('');
      setInternalNoteMode(false); // Switch back to message mode after note
      scrollToBottom();

      try {
        const res = await post(`/inbox/${conversationId}/notes`, { text: textToSend });
        if (res.success) {
          setMessages(prev => prev.map(m => m._id === tmpId ? { ...res.data, status: 'received' } : m));
          loadConversations();
        } else {
          setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
        }
      } catch (err) {
        console.error('[INBOX] Internal note error:', err);
        setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, status: 'failed' } : m));
        toast.error('Failed to add internal note');
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
      
      // UI Gap Fix: Handle 24h Session Window Expiration
      const errorMsg = error.message || (typeof error.response?.data === 'string' ? error.response.data : error.response?.data?.message) || '';
      
      if (errorMsg.includes('Session window expired') || errorMsg.includes('use template')) {
        toast.warning('WhatsApp 24h window expired. You must use a template to continue.');
        setShowTemplateModal(true);
      } else {
        toast?.error?.(errorMsg || 'Failed to send message');
      }
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

  const selectedConversation = conversations.find(c => (c._id || c.id) === selectedConversationId);

  return (
    <div className="fixed top-[60px] left-0 lg:left-[72px] right-0 bottom-0 bg-background text-foreground font-sans overflow-hidden flex z-20 transition-all duration-300">
      <ConversationsSidebar 
        conversations={conversations}
        loading={loading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedConversationId={selectedConversationId}
        handleSelectContact={handleSelectContact}
        currentView={currentView}
        setCurrentView={setCurrentView}
        openStartConversationModal={openStartConversationModal}
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        agents={agents}
        contactLabels={contactLabels}
        connected={connected}
        typingUsers={typingUsers}
        currentUser={currentUser}
      />

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
            <MessageThread 
              selectedContact={selectedContact}
              selectedConversationId={selectedConversationId}
              selectedConversation={selectedConversation}
              messages={messages}
              currentUser={currentUser}
              typingUsers={typingUsers}
              agents={agents}
              handleAssignConversation={handleAssignConversation}
              handleResolveConversation={handleResolveConversation}
              sending={sending}
              showLabelModal={showLabelModal}
              setShowLabelModal={setShowLabelModal}
              handleSetLabel={handleSetLabel}
              handleClearLabel={handleClearLabel}
              contactLabels={contactLabels}
              messagesEndRef={messagesEndRef}
              bspReady={bspReady}
              workspace={workspace}
            />

            <ChatInput 
              newMessage={newMessage}
              handleInputChange={handleInputChange}
              handleSendMessage={handleSendMessage}
              internalNoteMode={internalNoteMode}
              setInternalNoteMode={setInternalNoteMode}
              mediaPreview={mediaPreview}
              clearSelectedMedia={clearSelectedMedia}
              selectedMedia={selectedMedia}
              isUploading={isUploading}
              fileInputRef={fileInputRef}
              showQuickReplies={showQuickReplies}
              setShowQuickReplies={setShowQuickReplies}
              quickReplies={quickReplies}
              handleSelectQuickReply={handleSelectQuickReply}
              bspReady={bspReady}
              sending={sending}
              handleMediaSelect={handleMediaSelect}
              agents={agents}
            />
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

      {selectedContact && (
        <ContactDetailsSidebar 
          selectedContact={selectedContact}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          handleAddTag={handleAddTag}
          handleRemoveTag={handleRemoveTag}
          activeDeal={activeDeal}
          crmLoading={crmLoading}
          newNote={newNote}
          setNewNote={setNewNote}
          handleAddNote={handleAddNote}
          addingNote={addingNote}
        />
      )}

      <StartConversationModal 
        isOpen={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        contactSearch={contactSearch}
        onSearchChange={handleSearchStartContacts}
        contactOptions={contactOptions}
        selectedContact={selectedStartContact}
        onSelectContact={setSelectedStartContact}
        message={startMessage}
        onMessageChange={setStartMessage}
        onSubmit={handleStartConversation}
        loading={startingConversation}
      />
      {/* Template Selection Modal for 24h Policy Compliance */}
      <TemplateSelectorModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        contact={selectedContact}
        onSuccess={() => {
          toast.success('Template sent successfully. Session resumed.');
          // Optionally refresh conversation window
        }}
      />
    </div>
  );
}
