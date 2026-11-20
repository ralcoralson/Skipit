'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart,
  Share2,
  Flag,
  MessageCircle,
  ShieldCheck,
  Star,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import ListingCard from '@/components/ListingCard';
import { api } from '@/lib/api';

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [listing, setListing] = useState<any>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Prohibited Item or Scam');
  const [reportDescription, setReportDescription] = useState('');

  // Rental Request form states (Phase 5.1)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const fourDaysLater = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(fourDaysLater);
  const [rentalNotes, setRentalNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const calculatePrice = () => {
    if (!listing || !startDate || !endDate) return { totalDays: 0, totalPrice: 0, deposit: 0, handover: 0, months: 0, weeks: 0, remainingDays: 0 };
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffTime = Math.max(0, e.getTime() - s.getTime());
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    let remainingDays = totalDays;
    let months = 0;
    let weeks = 0;
    let totalPrice = 0;

    const monthlyRate = parseFloat(listing.price_per_month) || 0;
    const weeklyRate = parseFloat(listing.price_per_week) || 0;
    const dailyRate = parseFloat(listing.price_per_day) || 0;

    if (monthlyRate > 0 && remainingDays >= 30) {
      months = Math.floor(remainingDays / 30);
      totalPrice += months * monthlyRate;
      remainingDays %= 30;
    }
    if (weeklyRate > 0 && remainingDays >= 7) {
      weeks = Math.floor(remainingDays / 7);
      totalPrice += weeks * weeklyRate;
      remainingDays %= 7;
    }
    totalPrice += remainingDays * dailyRate;
    const deposit = parseFloat(listing.deposit_amount) || 0;

    return {
      totalDays,
      months,
      weeks,
      remainingDays,
      totalPrice,
      deposit,
      handover: totalPrice + deposit,
    };
  };

  const handleRequestRent = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError(null);
    try {
      await api.createRentalRequest({
        listing_id: id,
        start_date: startDate,
        end_date: endDate,
        notes: rentalNotes.trim() || undefined,
      });
      setBookingSuccess(true);
      setTimeout(() => {
        router.push('/rentals');
      }, 1200);
    } catch (err: any) {
      setBookingError(err.message || 'Failed to submit rental request');
    } finally {
      setBookingLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    async function loadListing() {
      try {
        setLoading(true);
        const res = await api.getListing(id);
        if (res?.listing) {
          setListing(res.listing);
          setIsSaved(res.listing.is_wishlisted || false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadListing();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs font-semibold text-text-secondary">Loading rental listing...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center glass-2 rounded-3xl m-8">
        <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-3" />
        <h2 className="text-xl font-bold text-text-primary">Listing Not Found</h2>
        <p className="text-xs text-text-secondary mt-1">This rental item may have been removed or paused.</p>
        <Link href="/browse" className="inline-block mt-4 px-5 py-2 liquid-blue-gradient text-white rounded-full text-xs font-bold shadow-md">
          Explore Other Rentals
        </Link>
      </div>
    );
  }

  const images = Array.isArray(listing.images) ? listing.images : [listing.images];
  const activeImage = images[selectedImageIndex] || images[0] || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=1000&q=80';

  const handleToggleWishlist = async () => {
    const token = localStorage.getItem('skipit_token');
    if (!token) {
      alert('Please sign in to save this listing');
      return;
    }
    try {
      if (isSaved) {
        await api.removeFromWishlist(listing.id);
        setIsSaved(false);
      } else {
        await api.addToWishlist(listing.id);
        setIsSaved(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: listing.title,
        text: `Rent ${listing.title} on SkipIt for ₹${listing.price_per_day}/day!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Listing link copied to clipboard!');
    }
  };

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('skipit_token');
    if (!token) {
      alert('Please sign in to message the owner');
      return;
    }

    try {
      setSendingInquiry(true);
      await api.sendInquiry({
        listing_id: listing.id,
        initial_message: inquiryText.trim() || undefined,
      });
      setInquirySuccess(true);
      setTimeout(() => {
        router.push(`/messages`);
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to send rental inquiry');
    } finally {
      setSendingInquiry(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.submitReport({
        listing_id: listing.id,
        reported_user_id: listing.owner_id,
        reason: reportReason,
        description: reportDescription,
      });
      alert('Thank you. Your report has been submitted to SkipIt moderation.');
      setReportModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-medium text-text-secondary">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        <Link href={`/browse?category=${encodeURIComponent(listing.category)}`} className="hover:text-primary">
          {listing.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-text-primary font-semibold truncate max-w-xs">{listing.title}</span>
      </nav>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gallery & Description Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo Card */}
          <div className="relative aspect-[4/3] w-full glass-2 rounded-3xl overflow-hidden border border-white/80 shadow-glass-md">
            <img
              src={activeImage}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 glass-3 text-primary text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
              {listing.condition || 'Good Condition'}
            </div>
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-20 h-20 rounded-2xl overflow-hidden glass-1 border-2 flex-shrink-0 transition ${
                    selectedImageIndex === idx ? 'border-primary scale-95 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Description Card */}
          <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 space-y-4 shadow-glass-sm">
            <h3 className="text-lg font-bold text-primary-navy">Item Description</h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>

            {/* Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/50">
              {listing.brand && (
                <div>
                  <span className="text-[10px] text-text-muted font-bold block uppercase tracking-wider">Brand</span>
                  <span className="text-xs font-bold text-text-primary">{listing.brand}</span>
                </div>
              )}
              {listing.model && (
                <div>
                  <span className="text-[10px] text-text-muted font-bold block uppercase tracking-wider">Model</span>
                  <span className="text-xs font-bold text-text-primary">{listing.model}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] text-text-muted font-bold block uppercase tracking-wider">Min Rental</span>
                <span className="text-xs font-bold text-text-primary">{listing.min_rental_days || 1} day(s)</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted font-bold block uppercase tracking-wider">Max Duration</span>
                <span className="text-xs font-bold text-text-primary">{listing.max_rental_days || 30} days</span>
              </div>
            </div>
          </div>

          {/* Rental Terms Card (Glass Level 1) */}
          <div className="glass-1 p-6 rounded-3xl border border-white/60 space-y-3">
            <div className="flex items-center gap-2 text-primary-navy font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Rental Guidelines & Terms</span>
            </div>
            <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
              <li>Rental fees and security deposits are settled directly between you and the owner.</li>
              <li>Inspect item condition, battery life, and cables together during handover.</li>
              <li>Return item on agreed date in clean, working condition.</li>
              <li>A valid government photo ID may be requested upon handover.</li>
            </ul>
          </div>
        </div>

        {/* Action Panel Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-3 p-6 sm:p-8 rounded-3xl border border-white/90 shadow-glass-md space-y-6">
            {/* Header with Title and Actions */}
            <div>
              <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
                <span className="font-extrabold uppercase tracking-wider text-primary text-[11px]">
                  {listing.category}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleWishlist}
                    className={`p-2 rounded-full glass-1 hover:glass-2 transition ${
                      isSaved ? 'text-functional-error bg-rose-50' : 'text-text-secondary'
                    }`}
                    title="Save to Wishlist"
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-2 rounded-full glass-1 hover:glass-2 text-text-secondary transition"
                    title="Share Listing"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setReportModalOpen(true)}
                    className="p-2 rounded-full glass-1 hover:glass-2 text-text-muted hover:text-functional-error transition"
                    title="Report Listing"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h1 className="text-2xl font-black text-primary-navy tracking-tight leading-snug">
                {listing.title}
              </h1>

              <div className="flex items-center gap-1 text-xs text-text-secondary mt-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span>{listing.location_name}</span>
              </div>
            </div>

            {/* Price Card */}
            <div className="p-4 glass-1 rounded-2xl border border-white/60 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-black text-primary-navy">₹{listing.price_per_day}</span>
                <span className="text-xs font-bold text-text-secondary"> / day</span>
                <div className="text-[11px] text-primary font-bold mt-0.5">
                  0% Commission • Direct Peer Rental
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-text-muted font-bold block uppercase tracking-wider">Deposit</span>
                <span className="text-sm font-bold text-text-primary">
                  {listing.deposit_amount > 0 ? `₹${listing.deposit_amount}` : 'No Deposit'}
                </span>
              </div>
            </div>

            {/* Request to Rent Form (Phase 5.1) */}
            <form onSubmit={handleRequestRent} className="space-y-3 p-4 glass-2 rounded-2xl border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Request to Rent</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  0% Commission
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 glass-1 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 glass-1 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {/* Price Breakdown */}
              {(() => {
                const pricing = calculatePrice();
                return (
                  <div className="p-2.5 bg-slate-50/70 rounded-xl space-y-1 text-xs border border-slate-200/50">
                    <div className="flex justify-between text-text-secondary">
                      <span>Duration:</span>
                      <span className="font-bold text-text-primary">{pricing.totalDays} day(s)</span>
                    </div>
                    {pricing.months > 0 && (
                      <div className="flex justify-between text-text-secondary text-[11px]">
                        <span>{pricing.months} month(s) rate:</span>
                        <span>₹{pricing.months * (parseFloat(listing.price_per_month) || 0)}</span>
                      </div>
                    )}
                    {pricing.weeks > 0 && (
                      <div className="flex justify-between text-text-secondary text-[11px]">
                        <span>{pricing.weeks} week(s) rate:</span>
                        <span>₹{pricing.weeks * (parseFloat(listing.price_per_week) || 0)}</span>
                      </div>
                    )}
                    {pricing.remainingDays > 0 && (
                      <div className="flex justify-between text-text-secondary text-[11px]">
                        <span>{pricing.remainingDays} day(s) @ ₹{listing.price_per_day}/day:</span>
                        <span>₹{pricing.remainingDays * parseFloat(listing.price_per_day)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-text-secondary pt-1 border-t border-slate-200/50">
                      <span>Rental Fee:</span>
                      <span className="font-bold text-text-primary">₹{pricing.totalPrice}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Refundable Deposit:</span>
                      <span className="font-bold text-text-primary">₹{pricing.deposit}</span>
                    </div>
                    <div className="flex justify-between text-primary font-bold pt-1 border-t border-slate-200/60 text-xs">
                      <span>Total on Handover:</span>
                      <span>₹{pricing.handover}</span>
                    </div>
                  </div>
                );
              })()}

              <textarea
                rows={2}
                value={rentalNotes}
                onChange={(e) => setRentalNotes(e.target.value)}
                placeholder="Optional notes to host (e.g. pickup time)..."
                className="w-full p-2 glass-1 rounded-xl text-xs outline-none resize-none"
              />

              {bookingError && (
                <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
                  {bookingError}
                </div>
              )}

              <button
                type="submit"
                disabled={bookingLoading || bookingSuccess}
                className="w-full py-3 bg-primary hover:bg-primary-navy text-white font-extrabold text-xs sm:text-sm rounded-xl transition shadow-md shadow-primary/20 flex items-center justify-center gap-1.5"
              >
                {bookingSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Request Submitted! Redirecting...</span>
                  </>
                ) : bookingLoading ? (
                  'Submitting Request...'
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Submit Rental Request</span>
                  </>
                )}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200/60"></div>
              <span className="flex-shrink mx-2 text-[10px] text-text-muted uppercase font-bold tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-200/60"></div>
            </div>

            {/* Direct Inquiry Form */}
            <form onSubmit={handleSendInquiry} className="space-y-3">
              <label className="block text-xs font-bold text-text-primary">
                Direct Rental Inquiry to Owner
              </label>
              <textarea
                rows={3}
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
                placeholder={`Hi ${listing.owner?.full_name || 'there'}! I'm interested in renting this. Is it available?`}
                className="w-full p-3 glass-1 rounded-2xl text-xs focus:glass-3 focus:ring-2 focus:ring-primary/20 outline-none resize-none transition"
              />

              <button
                type="submit"
                disabled={sendingInquiry || inquirySuccess}
                className="w-full py-3.5 liquid-blue-gradient text-white font-extrabold text-xs sm:text-sm rounded-2xl transition shadow-md shadow-primary/25 hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                {inquirySuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Inquiry Sent! Opening Chat...</span>
                  </>
                ) : sendingInquiry ? (
                  'Sending Inquiry...'
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    <span>Chat with Owner & Rent</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-text-muted">
                SkipIt is a discovery protocol. Rates, deposits, and handovers are arranged directly between users.
              </p>
            </form>

            {/* Owner Profile Card */}
            <div className="pt-6 border-t border-slate-200/50">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-3">
                Host Information
              </span>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-subtle text-primary flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                  {listing.owner?.avatar_url ? (
                    <img src={listing.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    listing.owner?.full_name?.charAt(0) || 'H'
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-text-primary text-sm truncate">
                      {listing.owner?.full_name || 'SkipIt Host'}
                    </span>
                    {listing.owner?.is_verified && (
                      <span title="Verified Member">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                    <div className="flex items-center gap-1 text-text-primary font-semibold">
                      <Star className="w-3.5 h-3.5 fill-functional-warning text-functional-warning" />
                      <span>{listing.owner?.rating || '5.0'}</span>
                    </div>
                    <span>•</span>
                    <span>Trust Score: {listing.owner?.trust_score || 70}/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Listings */}
      {listing.similarListings && listing.similarListings.length > 0 && (
        <div className="pt-8 border-t border-slate-200/50">
          <h3 className="text-xl font-black text-primary-navy mb-6">Similar in {listing.category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {listing.similarListings.map((sim: any) => (
              <ListingCard key={sim.id} listing={sim} />
            ))}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-navy/40 backdrop-blur-md">
          <div className="glass-3 rounded-3xl max-w-md w-full p-6 space-y-4 border border-white/90 shadow-glass-lg">
            <h3 className="text-lg font-bold text-text-primary">Report this Listing</h3>
            <p className="text-xs text-text-secondary">
              Help us maintain community trust. Our Trust & Safety team will review this listing.
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2.5 glass-1 rounded-xl text-xs outline-none focus:glass-3"
                >
                  <option value="Prohibited Item or Scam">Prohibited Item or Scam</option>
                  <option value="Inaccurate Pricing or Deposit">Inaccurate Pricing or Deposit</option>
                  <option value="Counterfeit or Broken Equipment">Counterfeit or Broken Equipment</option>
                  <option value="Spam or Duplicate Listing">Spam or Duplicate Listing</option>
                  <option value="Abusive or Harassing Content">Abusive or Harassing Content</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Details (Optional)</label>
                <textarea
                  rows={3}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  className="w-full p-2.5 glass-1 rounded-xl text-xs outline-none resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="flex-1 py-2.5 glass-1 hover:glass-2 text-text-secondary font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-functional-error hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
