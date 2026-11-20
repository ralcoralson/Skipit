'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  MessageSquare,
  ShieldCheck,
  Check,
  CheckCheck,
  Paperclip,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function MessagesPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load & Auth Check
  useEffect(() => {
    const token = localStorage.getItem('skipit_token');
    const storedUser = localStorage.getItem('skipit_user');
    if (!token) {
      alert('Please sign in to view your messages');
      router.push('/');
      return;
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {}
    }

    loadConversations();
  }, [router]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const res = await api.getConversations();
      if (res?.conversations) {
        setConversations(res.conversations);
        if (res.conversations.length > 0 && !activeConv) {
          selectConversation(res.conversations[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Select Active Conversation & Fetch Messages
  const selectConversation = async (conv: any) => {
    setActiveConv(conv);
    try {
      const res = await api.getMessages(conv.peer.id);
      if (res?.messages) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Connect Real-Time WebSocket with Auto-Reconnection & Secure JWT
  useEffect(() => {
    const token = localStorage.getItem('skipit_token');
    if (!token || !user) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;

      const defaultWsHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const defaultProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `${defaultProtocol}//${defaultWsHost}:5000`;

      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          ws?.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'message_received' || data.type === 'message_sent') {
              setMessages((prev) => [...prev, data.message]);
              loadConversations();
            } else if (data.type === 'user_typing') {
              if (activeConv && data.sender_id === activeConv.peer.id) {
                setPeerTyping(data.is_typing);
              }
            }
          } catch (e) {}
        };

        ws.onclose = (event) => {
          if (!isCleanedUp && event.code !== 1000) {
            // Attempt reconnect after 3 seconds
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          try {
            ws?.close();
          } catch (_) {}
        };
      } catch (e) {
        if (!isCleanedUp) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [user, activeConv]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv) return;

    const textToSend = inputText.trim();
    setInputText('');

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'send_message',
        receiver_id: activeConv.peer.id,
        content: textToSend,
        listing_id: activeConv.listing?.id,
      }));
    } else {
      try {
        const res = await api.sendMessage({
          receiver_id: activeConv.peer.id,
          content: textToSend,
          listing_id: activeConv.listing?.id,
        });
        if (res?.message) {
          setMessages((prev) => [...prev, res.message]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="glass-2 rounded-3xl border border-white/80 shadow-glass-md overflow-hidden h-[calc(100vh-9.5rem)] flex">
        {/* Left Column: Conversation List (Glass Sidebar) */}
        <div className="w-full sm:w-80 md:w-96 border-r border-slate-200/50 flex flex-col glass-1">
          <div className="p-4 border-b border-slate-200/50 glass-2">
            <h2 className="text-base font-black text-primary-navy">Rental Messages</h2>
            <p className="text-[11px] text-text-secondary">Direct peer communication & terms</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/50">
            {loading ? (
              <div className="p-8 text-center text-xs text-text-muted">Loading chats...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-text-muted mx-auto" />
                <p className="text-xs font-bold text-text-primary">No conversations yet</p>
                <p className="text-[11px] text-text-muted">
                  Tap &quot;Chat with Owner&quot; on any rental item to start!
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConv?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full p-4 text-left transition flex items-start gap-3 hover:glass-3 ${
                      isSelected ? 'glass-3 border-l-4 border-primary shadow-xs' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-subtle text-primary flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                      {conv.peer.avatar_url ? (
                        <img src={conv.peer.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        conv.peer.full_name?.charAt(0) || 'U'
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary truncate">
                          {conv.peer.full_name || 'SkipIt Member'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 liquid-blue-gradient text-white rounded-full text-[9px] font-black">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>

                      {conv.listing && (
                        <div className="text-[11px] text-primary font-bold truncate mt-0.5">
                          {conv.listing.title}
                        </div>
                      )}

                      <p className="text-xs text-text-secondary truncate mt-1">
                        {conv.last_message?.content || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Thread */}
        {activeConv ? (
          <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-md">
            {/* Glass Conversation Header with Listing Snapshot */}
            <div className="p-4 border-b border-slate-200/50 flex items-center justify-between glass-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-subtle text-primary flex items-center justify-center font-bold text-xs overflow-hidden">
                  {activeConv.peer.avatar_url ? (
                    <img src={activeConv.peer.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    activeConv.peer.full_name?.charAt(0) || 'U'
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-primary-navy">
                      {activeConv.peer.full_name || 'SkipIt User'}
                    </span>
                    {activeConv.peer.is_verified && (
                      <span title="Verified Member">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-primary font-medium">
                    {peerTyping ? 'Typing...' : 'Direct peer conversation'}
                  </span>
                </div>
              </div>

              {activeConv.listing && (
                <div className="hidden md:flex items-center gap-3 glass-1 px-3 py-1.5 rounded-xl border border-white/60">
                  <div className="text-right">
                    <span className="text-xs font-bold text-text-primary block truncate max-w-[180px]">
                      {activeConv.listing.title}
                    </span>
                    <span className="text-[11px] font-bold text-primary">
                      ₹{activeConv.listing.price_per_day}/day
                    </span>
                  </div>
                  {activeConv.listing.images && activeConv.listing.images[0] && (
                    <img
                      src={activeConv.listing.images[0]}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                const isInquiry = msg.content.startsWith('[RENTAL INQUIRY');

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-md p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                        isInquiry
                          ? 'glass-2 text-primary-navy border border-primary/30 font-medium'
                          : isMe
                          ? 'liquid-blue-gradient text-white rounded-br-none shadow-glass-sm'
                          : 'glass-3 text-text-primary rounded-bl-none border border-white/80'
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.content}</p>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-text-muted mt-1 px-1">
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        msg.is_read ? <CheckCheck className="w-3 h-3 text-primary" /> : <Check className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar (Frosted Glass Input) */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200/50 flex items-center gap-2 glass-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message (negotiate price, dates, deposit)..."
                className="flex-1 px-4 py-2.5 glass-1 rounded-full text-xs sm:text-sm outline-none focus:glass-3 focus:ring-2 focus:ring-primary/20 transition"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 liquid-blue-gradient disabled:opacity-40 text-white rounded-full transition shadow-md hover:scale-105"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-text-primary">Select a conversation</h3>
            <p className="text-xs text-text-secondary max-w-xs mt-1">
              Choose an active chat thread or contact an owner from the marketplace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
