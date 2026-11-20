'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  Send,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function SupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New ticket state
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await api.getTickets();
      if (res?.tickets) {
        setTickets(res.tickets);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      alert('Please fill out both the ticket subject and description.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });

      if (res?.ticket) {
        alert('Support ticket created successfully!');
        setSubject('');
        setDescription('');
        setPriority('normal');
        setShowCreateModal(false);
        loadTickets();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="glass-3 p-6 sm:p-8 rounded-3xl border border-white/90 shadow-glass-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl liquid-blue-gradient flex items-center justify-center text-white shadow-md shadow-primary/25">
            <LifeBuoy className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-primary-navy">Helpdesk & Support</h1>
            <p className="text-xs text-text-secondary mt-1">
              Have an issue with a rental, user conduct, or account verification? Submit a ticket directly to our team.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 liquid-blue-gradient text-white text-xs font-bold rounded-full shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Support Ticket</span>
        </button>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-primary-navy">Your Support Inquiries</h2>
          <button
            onClick={loadTickets}
            className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-semibold text-text-secondary">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center glass-1 rounded-3xl border border-dashed border-slate-300 space-y-2">
            <HelpCircle className="w-10 h-10 text-text-muted mx-auto" />
            <p className="text-sm font-bold text-text-primary">No open tickets</p>
            <p className="text-xs text-text-secondary">Need help? Open a support request and our team will get back to you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className="glass-2 p-5 rounded-2xl border border-white/80 hover:border-primary/40 shadow-glass-sm transition cursor-pointer flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        t.status === 'resolved' || t.status === 'closed'
                          ? 'bg-emerald-50 text-functional-success border border-emerald-200'
                          : t.status === 'in_progress'
                          ? 'bg-blue-50 text-primary border border-blue-200'
                          : 'bg-amber-50 text-functional-warning border border-amber-200'
                      }`}
                    >
                      {t.status || 'open'}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        t.priority === 'urgent'
                          ? 'bg-rose-50 text-rose-600'
                          : t.priority === 'high'
                          ? 'bg-amber-50 text-amber-600'
                          : 'glass-1 text-text-secondary'
                      }`}
                    >
                      {t.priority} priority
                    </span>
                  </div>

                  <h3 className="font-bold text-text-primary text-sm line-clamp-1">{t.subject}</h3>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">{t.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-text-muted">
                  <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1 text-primary font-semibold">
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-3 rounded-3xl max-w-lg w-full p-6 border border-white/90 shadow-glass-lg space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  activeTicket.status === 'resolved' || activeTicket.status === 'closed'
                    ? 'bg-emerald-50 text-functional-success'
                    : 'bg-amber-50 text-functional-warning'
                }`}
              >
                {activeTicket.status}
              </span>
              <button
                onClick={() => setActiveTicket(null)}
                className="text-text-muted hover:text-text-primary text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-primary-navy">{activeTicket.subject}</h3>
              <p className="text-xs text-text-muted mt-0.5">Priority: {activeTicket.priority} • Ticket ID: {activeTicket.id}</p>
            </div>

            <div className="p-4 glass-1 rounded-2xl text-xs text-text-primary leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {activeTicket.description}
            </div>

            {activeTicket.admin_notes && (
              <div className="p-4 bg-blue-50/70 border border-blue-200/60 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                  Support Representative Response
                </span>
                <p className="text-xs text-text-primary leading-relaxed">{activeTicket.admin_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-3 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-white/90 shadow-glass-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-primary-navy">Submit Support Request</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-primary text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Issue returning camera gear / Damage dispute"
                  className="w-full px-4 py-2.5 glass-1 rounded-xl text-xs sm:text-sm outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-4 py-2.5 glass-1 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                >
                  <option value="low">Low - General query</option>
                  <option value="normal">Normal - Standard inquiry</option>
                  <option value="high">High - Active rental issue</option>
                  <option value="urgent">Urgent - Safety or theft incident</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe the issue in detail, including dates, listing names, or parties involved..."
                  className="w-full p-3 glass-1 rounded-xl text-xs outline-none focus:border-primary resize-none"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 glass-1 hover:glass-2 text-text-secondary text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 liquid-blue-gradient text-white text-xs font-bold rounded-xl shadow-md transition"
                >
                  {submitting ? 'Submitting...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
