'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageCircle,
  Star,
  RefreshCw,
  User,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function RentalsPage() {
  const [activeTab, setActiveTab] = useState<'my' | 'incoming'>('my');
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [incomingRentals, setIncomingRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected rental for modal/action
  const [selectedRental, setSelectedRental] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [responseNote, setResponseNote] = useState('');

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    loadRentals();
  }, []);

  const loadRentals = async () => {
    setLoading(true);
    setError(null);
    try {
      const [myRes, incRes] = await Promise.all([
        api.getMyRentals().catch(() => ({ rentals: [] })),
        api.getIncomingRentals().catch(() => ({ rentals: [] })),
      ]);
      setMyRentals(myRes.rentals || []);
      setIncomingRentals(incRes.rentals || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load rentals');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (status: 'accepted' | 'rejected') => {
    if (!selectedRental) return;
    setActionLoading(true);
    try {
      await api.respondRental(selectedRental.id, status, responseNote);
      setSelectedRental(null);
      setResponseNote('');
      await loadRentals();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (rentalId: string) => {
    if (!confirm('Are you sure you want to cancel this rental request?')) return;
    try {
      await api.cancelRental(rentalId);
      setSelectedRental(null);
      await loadRentals();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const handleComplete = async (rentalId: string) => {
    if (!confirm('Confirm that the rental item has been returned safely? This will mark the rental as completed and increment total rentals for both members.')) return;
    try {
      await api.completeRental(rentalId);
      setSelectedRental(null);
      await loadRentals();
    } catch (err: any) {
      alert(`Complete failed: ${err.message}`);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental) return;
    setReviewSubmitting(true);
    try {
      const isOwner = activeTab === 'incoming';
      const targetUserId = isOwner ? selectedRental.renter_id : selectedRental.owner_id;

      await api.createReview({
        rental_request_id: selectedRental.id,
        reviewee_id: targetUserId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      alert('Review submitted successfully! Thank you for building community trust.');
      setReviewModalOpen(false);
      setReviewComment('');
      setSelectedRental(null);
      await loadRentals();
    } catch (err: any) {
      alert(`Review submission failed: ${err.message}`);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const currentList = activeTab === 'my' ? myRentals : incomingRentals;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-primary-navy tracking-tight">Rentals Hub</h1>
          <p className="text-xs text-text-secondary mt-1">
            Manage your peer-to-peer rental requests, handovers, and completed gear returns.
          </p>
        </div>
        <button
          onClick={loadRentals}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-primary glass-1 rounded-xl hover:glass-2 transition self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 glass-1 rounded-2xl max-w-md mb-8">
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === 'my' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          My Requests ({myRentals.length})
        </button>
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
            activeTab === 'incoming' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Incoming Host Requests ({incomingRentals.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-text-muted mt-3">Loading rentals...</p>
        </div>
      ) : error ? (
        <div className="p-6 glass-3 rounded-2xl max-w-md mx-auto text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-bold text-text-primary">{error}</p>
          <button onClick={loadRentals} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">
            Retry
          </button>
        </div>
      ) : currentList.length === 0 ? (
        <div className="py-20 text-center glass-1 rounded-3xl max-w-lg mx-auto p-8 space-y-3">
          <Calendar className="w-12 h-12 text-text-muted mx-auto" />
          <h3 className="text-base font-bold text-text-primary">
            {activeTab === 'my' ? 'No rental requests sent' : 'No incoming rental requests'}
          </h3>
          <p className="text-xs text-text-secondary">
            {activeTab === 'my'
              ? 'Find gear you need in Browse and submit a direct rental request to the owner.'
              : 'When neighbors request to rent your equipment, their requests will appear here for your approval.'}
          </p>
          {activeTab === 'my' && (
            <Link
              href="/browse"
              className="inline-block mt-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-md"
            >
              Browse Equipment
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentList.map((rental) => {
            const partner = activeTab === 'incoming' ? rental.renter : rental.owner;
            const partnerRole = activeTab === 'incoming' ? 'Renter' : 'Host';

            return (
              <div
                key={rental.id}
                className="glass-2 rounded-2xl p-5 border border-slate-200/50 flex flex-col justify-between hover:shadow-lg transition space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                        Listing
                      </span>
                      <Link
                        href={`/listings/${rental.listing_id}`}
                        className="text-base font-extrabold text-primary-navy hover:text-primary transition line-clamp-1"
                      >
                        {rental.listing?.title || 'Rental Item'}
                      </Link>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        rental.request_status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rental.request_status === 'completed'
                          ? 'bg-purple-100 text-purple-800'
                          : rental.request_status === 'rejected' || rental.request_status === 'cancelled'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rental.request_status}
                    </span>
                  </div>

                  {/* Dates & Cost */}
                  <div className="p-3 bg-slate-50/80 rounded-xl space-y-1.5 text-xs border border-slate-200/40 mb-3">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Dates:</span>
                      <span className="font-bold text-text-primary">
                        {rental.start_date} → {rental.end_date} ({rental.total_days}d)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Rental Fee:</span>
                      <span className="font-bold text-primary">₹{rental.total_price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Security Deposit:</span>
                      <span className="font-bold text-text-primary">
                        {rental.security_deposit > 0 ? `₹${rental.security_deposit}` : '₹0'}
                      </span>
                    </div>
                  </div>

                  {/* Counterpart info */}
                  <div className="flex items-center gap-2.5 text-xs text-text-secondary">
                    <div className="w-8 h-8 rounded-full bg-primary-subtle text-primary flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                      {partner?.avatar_url ? (
                        <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        partner?.full_name?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-text-primary truncate">
                        {partnerRole}: {partner?.full_name || 'Member'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        Trust Score: {partner?.trust_score || 70}/100
                        {rental.request_status === 'accepted' && partner?.phone && (
                          <span className="text-emerald-700 font-bold ml-1.5">📞 {partner.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-200/50 flex flex-wrap gap-2">
                  {activeTab === 'incoming' && rental.request_status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedRental(rental);
                          handleRespond('accepted');
                        }}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRental(rental);
                          handleRespond('rejected');
                        }}
                        className="flex-1 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-text-secondary rounded-xl text-xs font-bold transition"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {activeTab === 'incoming' && rental.request_status === 'accepted' && (
                    <button
                      onClick={() => handleComplete(rental.id)}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Return Completed</span>
                    </button>
                  )}

                  {(rental.request_status === 'pending' || rental.request_status === 'accepted') && (
                    <button
                      onClick={() => handleCancel(rental.id)}
                      className="w-full py-1.5 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-xl transition"
                    >
                      Cancel Request
                    </button>
                  )}

                  {rental.request_status === 'completed' && (
                    <button
                      onClick={() => {
                        setSelectedRental(rental);
                        setReviewModalOpen(true);
                      }}
                      className="w-full py-2 bg-primary hover:bg-primary-navy text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Star className="w-3.5 h-3.5 fill-white" />
                      <span>Leave Verified Review</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verified Review Modal */}
      {reviewModalOpen && selectedRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-navy/40 backdrop-blur-md">
          <div className="glass-3 rounded-3xl max-w-md w-full p-6 space-y-4 border border-white/90 shadow-glass-lg">
            <h3 className="text-lg font-bold text-text-primary">Leave Verified Review</h3>
            <p className="text-xs text-text-secondary">
              Reviewing your rental of &quot;{selectedRental.listing?.title}&quot;. Verified reviews reward responsible
              community members with higher trust scores.
            </p>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setReviewRating(s)}
                      className={`p-2 rounded-xl transition ${
                        reviewRating >= s ? 'text-amber-400 bg-amber-50' : 'text-slate-300'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Comments</label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details about punctuality, equipment care, and communication..."
                  className="w-full p-2.5 glass-1 rounded-xl text-xs outline-none resize-none focus:glass-3"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="flex-1 py-2.5 glass-1 hover:glass-2 text-text-secondary font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary-navy text-white font-bold text-xs rounded-xl shadow-md"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
