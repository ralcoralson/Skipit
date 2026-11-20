'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  ShieldCheck,
  Star,
  MapPin,
  Heart,
  Package,
  PlusCircle,
  Eye,
  Trash2,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Camera,
  UserX,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import ListingCard from '@/components/ListingCard';
import { api } from '@/lib/api';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';

  const [activeTab, setActiveTab] = useState<'profile' | 'my-listings' | 'wishlist' | 'safety'>(
    initialTab === 'wishlist' ? 'wishlist' : initialTab === 'listings' ? 'my-listings' : initialTab === 'safety' ? 'safety' : 'profile'
  );

  const [profile, setProfile] = useState<any>(null);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Account deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Edit Profile fields
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // KYC submission
  const [kycDocType, setKycDocType] = useState('Aadhaar / National ID');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('skipit_token');
    if (!token) {
      alert('Please sign in to view your profile');
      router.push('/');
      return;
    }

    loadDashboardData();
  }, [router]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [userRes, listRes, wishRes, blockedRes] = await Promise.all([
        api.getMe(),
        api.getMyListings(),
        api.getWishlist(),
        api.getBlockedUsers().catch(() => ({ blocked_users: [] })),
      ]);

      if (userRes?.user) {
        setProfile(userRes.user);
        setFullName(userRes.user.full_name || '');
        setBio(userRes.user.bio || '');
        setLocation(userRes.user.location || '');
      }
      if (listRes?.listings) setMyListings(listRes.listings);
      if (wishRes?.wishlist) setWishlist(wishRes.wishlist);
      if (blockedRes?.blocked_users) setBlockedUsers(blockedRes.blocked_users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.uploadAvatar(formData);
      if (res?.avatar_url) {
        const updated = { ...profile, avatar_url: res.avatar_url };
        setProfile(updated);
        localStorage.setItem('skipit_user', JSON.stringify(updated));
        alert('Avatar updated successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload avatar image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      await api.unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((b) => b.blocked_user_id !== userId && b.id !== userId));
      alert('User unblocked');
    } catch (err: any) {
      alert(err.message || 'Failed to unblock user');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm permanent account deletion.');
      return;
    }

    try {
      setDeletingAccount(true);
      await api.deleteAccount();
      localStorage.removeItem('skipit_token');
      localStorage.removeItem('skipit_user');
      alert('Your SkipIt account and associated data have been permanently deleted.');
      router.push('/');
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await api.updateProfile({ full_name: fullName, bio, location });
      if (res?.user) {
        setProfile(res.user);
        localStorage.setItem('skipit_user', JSON.stringify(res.user));
        setProfileMsg('Profile updated successfully!');
        setTimeout(() => setProfileMsg(null), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleListing = async (listingId: string) => {
    try {
      await api.toggleListingStatus(listingId);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to update listing status');
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to permanently delete this rental listing?')) return;
    try {
      await api.deleteListing(listingId);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete listing');
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !selfieFile) {
      alert('Please select both ID document and a verification selfie');
      return;
    }

    try {
      setSubmittingKyc(true);
      const formData = new FormData();
      formData.append('document_type', kycDocType);
      formData.append('document', docFile);
      formData.append('selfie', selfieFile);

      const res = await api.submitKyc(formData);
      if (res?.user) {
        setProfile(res.user);
        alert('KYC verification submitted successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit KYC documents');
    } finally {
      setSubmittingKyc(false);
    }
  };

  if (loading) {
    return <div className="p-16 text-center text-xs font-semibold text-text-secondary">Loading profile...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Profile Overview Card (Glass Level 3) */}
      <div className="glass-3 p-6 sm:p-8 rounded-3xl border border-white/90 shadow-glass-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="relative group w-20 h-20 rounded-full bg-primary-subtle flex items-center justify-center font-black text-2xl text-primary overflow-hidden shadow-inner">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              profile?.full_name?.charAt(0) || 'U'
            )}
            <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
              <Camera className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">{uploadingAvatar ? '...' : 'Upload'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-black text-primary-navy">{profile?.full_name || 'SkipIt Member'}</h1>
              {profile?.is_verified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Host</span>
                </span>
              )}
            </div>

            <p className="text-xs text-text-secondary mt-1">{profile?.phone || profile?.email}</p>
            <p className="text-xs text-text-muted mt-0.5 flex items-center justify-center sm:justify-start gap-1">
              <MapPin className="w-3 h-3 text-primary" />
              <span>{profile?.location || 'Bengaluru, India'}</span>
            </p>
          </div>
        </div>

        {/* Stats Glass */}
        <div className="flex items-center gap-6 glass-1 p-4 rounded-2xl border border-white/60">
          <div className="text-center">
            <span className="text-2xl font-black text-primary">{profile?.trust_score || 70}</span>
            <span className="text-[10px] font-bold text-text-muted block uppercase tracking-wider">Trust Score</span>
          </div>
          <div className="w-px h-8 bg-slate-200/60"></div>
          <div className="text-center">
            <span className="text-2xl font-black text-primary-navy">{myListings.length}</span>
            <span className="text-[10px] font-bold text-text-muted block uppercase tracking-wider">Listings</span>
          </div>
          <div className="w-px h-8 bg-slate-200/60"></div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-primary-navy">
              <Star className="w-4 h-4 fill-functional-warning text-functional-warning" />
              <span className="text-2xl font-black">{profile?.rating || '5.0'}</span>
            </div>
            <span className="text-[10px] font-bold text-text-muted block uppercase tracking-wider">Rating</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/50 text-xs sm:text-sm font-bold text-text-secondary gap-8">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 transition relative ${activeTab === 'profile' ? 'text-primary' : 'hover:text-primary-navy'}`}
        >
          <span>Profile & Verification</span>
          {activeTab === 'profile' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
        </button>

        <button
          onClick={() => setActiveTab('my-listings')}
          className={`pb-3 transition relative flex items-center gap-2 ${activeTab === 'my-listings' ? 'text-primary' : 'hover:text-primary-navy'}`}
        >
          <span>My Listings</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full glass-1 text-primary font-bold">{myListings.length}</span>
          {activeTab === 'my-listings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
        </button>

        <button
          onClick={() => setActiveTab('wishlist')}
          className={`pb-3 transition relative flex items-center gap-2 ${activeTab === 'wishlist' ? 'text-primary' : 'hover:text-primary-navy'}`}
        >
          <span>Saved Wishlist</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full glass-1 text-primary font-bold">{wishlist.length}</span>
          {activeTab === 'wishlist' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
        </button>

        <button
          onClick={() => setActiveTab('safety')}
          className={`pb-3 transition relative flex items-center gap-2 ${activeTab === 'safety' ? 'text-primary' : 'hover:text-primary-navy'}`}
        >
          <span>Safety & Privacy</span>
          {blockedUsers.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full glass-1 text-text-secondary font-bold">{blockedUsers.length}</span>
          )}
          {activeTab === 'safety' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
        </button>
      </div>

      {/* TAB 1: PROFILE & KYC */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Edit Form */}
          <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 shadow-glass-sm space-y-4">
            <h3 className="text-base font-bold text-primary-navy">Personal Information</h3>

            {profileMsg && (
              <div className="p-3 bg-emerald-50 text-functional-success text-xs rounded-xl font-bold">
                {profileMsg}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 glass-1 rounded-xl text-xs sm:text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Location / City</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Indiranagar, Bengaluru"
                  className="w-full px-4 py-2.5 glass-1 rounded-xl text-xs sm:text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Introduce yourself to fellow renters..."
                  className="w-full p-3 glass-1 rounded-xl text-xs outline-none focus:border-primary resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 liquid-blue-gradient text-white font-bold text-xs rounded-full transition shadow-md"
              >
                {savingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* KYC Status Card */}
          <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 shadow-glass-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-primary-navy">Identity Verification</h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                profile?.kyc_status === 'approved'
                  ? 'bg-emerald-50 text-functional-success border border-emerald-200'
                  : profile?.kyc_status === 'pending'
                  ? 'bg-amber-50 text-functional-warning border border-amber-200'
                  : 'glass-1 text-text-secondary'
              }`}>
                {profile?.kyc_status || 'Unverified'}
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Verify your identity with an official government ID card to earn a verified trust badge.
            </p>

            {profile?.kyc_status === 'approved' ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3 text-functional-success text-xs font-semibold">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>Your identity is verified! Your trust badge is live.</span>
              </div>
            ) : profile?.kyc_status === 'pending' ? (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-3 text-functional-warning text-xs font-semibold">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>Your verification documents are currently under review by our moderation team.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitKyc} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">Document Type</label>
                  <select
                    value={kycDocType}
                    onChange={(e) => setKycDocType(e.target.value)}
                    className="w-full p-2.5 glass-1 rounded-xl text-xs font-semibold text-text-primary outline-none focus:border-primary"
                  >
                    <option value="Aadhaar / National ID">Aadhaar / National ID Card</option>
                    <option value="Driver License">Driver&apos;s License</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1">ID Document Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      className="text-xs text-text-secondary file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:glass-1 file:text-text-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1">Live Selfie</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                      className="text-xs text-text-secondary file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:glass-1 file:text-text-primary"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingKyc}
                  className="w-full py-3 liquid-blue-gradient text-white font-bold text-xs rounded-xl transition shadow-md"
                >
                  {submittingKyc ? 'Submitting...' : 'Submit Verification for Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY LISTINGS */}
      {activeTab === 'my-listings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-primary-navy">Manage Your Listings</h3>
            <Link
              href="/listings/create"
              className="px-4 py-2 liquid-blue-gradient text-white text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Item</span>
            </Link>
          </div>

          {myListings.length === 0 ? (
            <div className="p-12 text-center glass-1 rounded-3xl border border-dashed border-slate-300 space-y-3">
              <Package className="w-10 h-10 text-text-muted mx-auto" />
              <p className="text-sm font-bold text-text-primary">No items listed yet</p>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Got equipment sitting idle? List on SkipIt with 0% platform commission!
              </p>
              <Link
                href="/listings/create"
                className="inline-block mt-2 px-5 py-2.5 liquid-blue-gradient text-white text-xs font-bold rounded-full shadow-md"
              >
                Post Your First Listing
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myListings.map((item) => (
                <div key={item.id} className="glass-2 rounded-2xl border border-white/80 overflow-hidden flex flex-col justify-between shadow-glass-sm">
                  <div className="relative aspect-[16/9] bg-slate-100">
                    <img
                      src={item.images?.[0] || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&q=80'}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.is_available ? 'bg-primary text-white' : 'glass-navy text-white'
                    }`}>
                      {item.is_available ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-text-primary text-sm line-clamp-1">{item.title}</h4>
                      <p className="text-xs text-primary font-bold mt-1">₹{item.price_per_day} / day</p>
                      <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        <span>{item.views_count || 0} views</span>
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-200/50 flex items-center justify-between text-xs font-semibold">
                      <button
                        onClick={() => handleToggleListing(item.id)}
                        className={`flex items-center gap-1 ${
                          item.is_available ? 'text-functional-warning' : 'text-primary'
                        }`}
                      >
                        {item.is_available ? (
                          <>
                            <PauseCircle className="w-4 h-4" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-4 h-4" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <Link href={`/listings/${item.id}`} className="text-text-secondary hover:text-primary">
                          View
                        </Link>
                        <button
                          onClick={() => handleDeleteListing(item.id)}
                          className="text-functional-error hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WISHLIST */}
      {activeTab === 'wishlist' && (
        <div className="space-y-6">
          <h3 className="text-xl font-black text-primary-navy">Saved Wishlist</h3>
          {wishlist.length === 0 ? (
            <div className="p-12 text-center glass-1 rounded-3xl border border-dashed border-slate-300">
              <Heart className="w-10 h-10 text-text-muted mx-auto mb-2" />
              <p className="text-sm font-bold text-text-primary">Your wishlist is empty</p>
              <p className="text-xs text-text-secondary mt-1">
                Save gear to your wishlist to quickly find it when planning projects!
              </p>
              <Link href="/browse" className="inline-block mt-4 px-5 py-2 liquid-blue-gradient text-white rounded-full text-xs font-bold shadow-md">
                Explore Rentals
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {wishlist.map((item) => (
                <ListingCard key={item.id} listing={item.listing || item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SAFETY & PRIVACY */}
      {activeTab === 'safety' && (
        <div className="space-y-8 animate-fade-in max-w-4xl">
          {/* Blocked Users */}
          <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 shadow-glass-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-primary-navy flex items-center gap-2">
                  <UserX className="w-5 h-5 text-functional-error" />
                  <span>Blocked Users</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Blocked members cannot view your listings, message you, or submit rental requests.
                </p>
              </div>
              <span className="text-xs font-bold text-text-secondary px-3 py-1 glass-1 rounded-full">
                {blockedUsers.length} Blocked
              </span>
            </div>

            {blockedUsers.length === 0 ? (
              <div className="p-8 text-center glass-1 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold text-text-muted">You haven&apos;t blocked any users yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {blockedUsers.map((item) => {
                  const blockedId = item.blocked_user_id || item.blocked_id || item.id;
                  const blockedName = item.blocked_user?.full_name || item.full_name || 'SkipIt Member';
                  const blockedEmail = item.blocked_user?.email || item.email || '';
                  return (
                    <div key={item.id || blockedId} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-text-primary">{blockedName}</p>
                        {blockedEmail && <p className="text-[11px] text-text-secondary">{blockedEmail}</p>}
                      </div>
                      <button
                        onClick={() => handleUnblockUser(blockedId)}
                        className="px-3 py-1.5 glass-1 hover:glass-2 text-xs font-bold text-primary rounded-xl border border-primary/20 transition"
                      >
                        Unblock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account Deletion (Danger Zone) */}
          <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-rose-200/60 shadow-glass-sm space-y-4 bg-rose-50/20">
            <div>
              <h3 className="text-base font-bold text-functional-error flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-functional-error" />
                <span>Delete Account & Personal Data</span>
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Permanently purge your account, profile, uploaded ID/selfie documents, listings, reviews, and messaging history. Under India DPDP compliance regulations, this process is irreversible.
              </p>
            </div>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              Delete My SkipIt Account
            </button>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-3 rounded-3xl max-w-md w-full p-6 border border-white/90 shadow-glass-lg space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-functional-error flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-primary-navy">Confirm Permanent Deletion</h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                This will delete your profile, listings, and all stored KYC documents. All data will be purged.
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-functional-error font-semibold">
              Type <span className="font-mono font-black text-rose-700">DELETE</span> below to confirm:
            </div>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2.5 glass-1 rounded-xl text-xs sm:text-sm font-mono text-center tracking-wider focus:border-rose-500 outline-none"
            />

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 py-2.5 glass-1 hover:glass-2 text-text-secondary text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                {deletingAccount ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-semibold text-text-secondary">Loading profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
