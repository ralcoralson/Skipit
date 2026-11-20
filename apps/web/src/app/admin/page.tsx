'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Package,
  Flag,
  FileCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  Mail,
  UserX,
  UserCheck,
  Search,
  ExternalLink,
  LogOut,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminDashboardPage() {
  const router = useRouter();

  // Auth state
  const [isAdminAuth, setIsAdminAuth] = useState<boolean | null>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('admin@skipit.com');
  const [loginPassword, setLoginPassword] = useState('Admin@SkipIt2026!');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard Data
  const [metrics, setMetrics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'kyc' | 'users' | 'reports' | 'tickets'>('metrics');
  const [loading, setLoading] = useState(false);

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'banned'>('all');

  // KYC state
  const [kycQueue, setKycQueue] = useState<any[]>([]);
  const [kycTabStatus, setKycTabStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [kycSignedUrls, setKycSignedUrls] = useState<Record<string, { document_url: string; selfie_url: string }>>({});

  // Ban modal state
  const [banModalUser, setBanModalUser] = useState<any | null>(null);
  const [banReason, setBanReason] = useState('Violation of SkipIt P2P Marketplace Terms');

  // Reports state
  const [reports, setReports] = useState<any[]>([]);

  // Support Tickets state
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = () => {
    const token = localStorage.getItem('skipit_token');
    const storedUser = localStorage.getItem('skipit_user');

    if (!token || !storedUser) {
      setIsAdminAuth(false);
      return;
    }

    try {
      const u = JSON.parse(storedUser);
      if (u.role === 'admin' || u.role === 'moderator') {
        setIsAdminAuth(true);
        setAdminUser(u);
        loadAdminData();
      } else {
        setIsAdminAuth(false);
      }
    } catch {
      setIsAdminAuth(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await api.login({ email: loginEmail.trim(), password: loginPassword });
      if (res.user?.role !== 'admin' && res.user?.role !== 'moderator') {
        throw new Error('This account does not have administrator or moderator permissions.');
      }

      localStorage.setItem('skipit_token', res.token);
      localStorage.setItem('skipit_user', JSON.stringify(res.user));
      setAdminUser(res.user);
      setIsAdminAuth(true);
      loadAdminData();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid administrator credentials');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('skipit_token');
    localStorage.removeItem('skipit_user');
    setIsAdminAuth(false);
    setAdminUser(null);
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [mRes, kycRes, repRes, uRes, tRes] = await Promise.all([
        api.getAdminMetrics().catch(() => null),
        api.getKycSubmissions().catch(() => null),
        api.getAdminReports().catch(() => null),
        api.getAdminUsers().catch(() => null),
        api.getAdminTickets().catch(() => null),
      ]);

      if (mRes?.metrics) setMetrics(mRes.metrics);
      if (kycRes?.submissions) {
        setKycQueue(kycRes.submissions);
        // Pre-fetch signed URLs for pending submissions safely
        for (const item of kycRes.submissions) {
          api.getKycSignedUrls(item.id)
            .then((urls) => {
              if (urls) {
                setKycSignedUrls((prev) => ({ ...prev, [item.id]: urls }));
              }
            })
            .catch(() => {});
        }
      }
      if (repRes?.reports) setReports(repRes.reports);
      if (uRes?.users) setUsers(uRes.users);
      if (tRes?.tickets) setTickets(tRes.tickets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // BAN / UNBAN USER WITH PRIVILEGE PROTECTION
  const executeToggleBan = async (userId: string, isBanned: boolean, reason?: string) => {
    if (userId === adminUser?.id) {
      alert('Security Protection: You cannot ban your own administrator account.');
      return;
    }
    const target = users.find((u) => u.id === userId) || banModalUser;
    if (target?.role === 'admin') {
      alert('Security Protection: Administrator accounts cannot be banned.');
      return;
    }

    try {
      await api.toggleBanUser(userId, isBanned, reason || 'Admin moderation action');
      setBanModalUser(null);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user ban status');
    }
  };

  // KYC REVIEW
  const handleReviewKyc = async (userId: string, status: 'approved' | 'rejected') => {
    const notes = prompt(
      `Enter reviewer notes for ${status.toUpperCase()} decision:`,
      status === 'approved' ? 'Verified official identification' : 'Unclear document photos. Please resubmit.'
    );

    if (notes === null) return; // Cancelled

    try {
      await api.reviewKyc(userId, status, notes);
      alert(`KYC submission successfully ${status.toUpperCase()}`);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Review submission failed');
    }
  };

  const handleUpdateTicket = async (ticketId: string, updates: { status?: string; priority?: string; admin_notes?: string }) => {
    try {
      await api.updateAdminTicket(ticketId, updates);
      alert('Support ticket updated successfully');
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket');
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await api.resolveReport(reportId, status);
      alert(`Report marked as ${status}`);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update report');
    }
  };

  // 1. RENDER ADMIN LOGIN IF NOT AUTHENTICATED
  if (isAdminAuth === false) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="glass-3 rounded-3xl max-w-md w-full p-8 border border-white/90 shadow-glass-lg relative">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl liquid-blue-gradient flex items-center justify-center text-white shadow-lg shadow-primary/25 mx-auto mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-primary-navy">SkipIt Admin Portal</h2>
            <p className="text-xs text-text-secondary mt-1">
              Authorized personnel only. Moderation & KYC control panel.
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-functional-error text-xs rounded-xl font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Admin Login ID</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@skipit.com"
                  className="w-full pl-10 pr-4 py-2.5 glass-1 rounded-xl text-sm focus:border-primary outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Admin Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 glass-1 rounded-xl text-sm focus:border-primary outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 liquid-blue-gradient text-white font-bold text-sm rounded-xl transition shadow-md shadow-primary/25 hover:scale-[1.01]"
            >
              {loginLoading ? 'Authenticating Admin...' : 'Sign In to Admin Portal'}
            </button>
          </form>

          {/* Preset Credentials Box */}
          <div className="mt-6 p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" />
                Official Admin Credentials
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoginEmail('admin@skipit.com');
                  setLoginPassword('Admin@SkipIt2026!');
                }}
                className="text-[11px] font-bold text-primary underline"
              >
                Autofill
              </button>
            </div>
            <p className="text-[11px] text-text-secondary">
              ID: <code className="font-mono font-bold text-text-primary">admin@skipit.com</code>
            </p>
            <p className="text-[11px] text-text-secondary">
              Pass: <code className="font-mono font-bold text-text-primary">Admin@SkipIt2026!</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isAdminAuth === null || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs font-semibold text-text-secondary">
        <RefreshCw className="w-4 h-4 animate-spin text-primary mr-2" />
        Loading SkipIt Admin Console...
      </div>
    );
  }

  // Filtered users for User Management tab
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !userSearch ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch);

    if (userStatusFilter === 'active') return matchesSearch && !u.is_banned;
    if (userStatusFilter === 'banned') return matchesSearch && u.is_banned;
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Top Admin Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/50">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl liquid-blue-gradient flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-black text-primary-navy tracking-tight">SkipIt Admin Portal</h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Logged in as <strong className="text-text-primary">{adminUser?.full_name || 'Lead Administrator'}</strong> ({adminUser?.role})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAdminData}
            className="px-3.5 py-2 glass-2 hover:glass-3 text-text-primary text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleAdminLogout}
            className="px-3.5 py-2 glass-1 hover:bg-rose-50 text-functional-error text-xs font-bold rounded-xl flex items-center gap-1.5 transition border border-rose-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Glass Level 2) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-2 p-5 rounded-2xl border border-white/80 shadow-glass-sm">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <span className="text-2xl font-black text-primary-navy">{metrics?.totalUsers || users.length}</span>
        </div>

        <div className="glass-2 p-5 rounded-2xl border border-white/80 shadow-glass-sm">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Listings</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <span className="text-2xl font-black text-primary-navy">{metrics?.activeListings || 0}</span>
        </div>

        <div className="glass-2 p-5 rounded-2xl border border-white/80 shadow-glass-sm">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending KYC</span>
            <FileCheck className="w-4 h-4 text-functional-warning" />
          </div>
          <span className="text-2xl font-black text-functional-warning">{kycQueue.length}</span>
        </div>

        <div className="glass-2 p-5 rounded-2xl border border-white/80 shadow-glass-sm">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Open Reports</span>
            <Flag className="w-4 h-4 text-functional-error" />
          </div>
          <span className="text-2xl font-black text-functional-error">{reports.length}</span>
        </div>

        <div className="glass-2 p-5 rounded-2xl border border-white/80 shadow-glass-sm">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Fee Model</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <span className="text-2xl font-black text-primary">0% Free P2P</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200/50 text-xs font-bold text-text-secondary gap-6">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`pb-3 transition ${activeTab === 'metrics' ? 'text-primary border-b-2 border-primary' : 'hover:text-primary-navy'}`}
        >
          Overview & System
        </button>
        <button
          onClick={() => setActiveTab('kyc')}
          className={`pb-3 transition flex items-center gap-1.5 ${activeTab === 'kyc' ? 'text-primary border-b-2 border-primary' : 'hover:text-primary-navy'}`}
        >
          <span>KYC Verifications</span>
          {kycQueue.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-functional-warning text-white text-[9px] font-extrabold animate-pulse">
              {kycQueue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 transition flex items-center gap-1.5 ${activeTab === 'users' ? 'text-primary border-b-2 border-primary' : 'hover:text-primary-navy'}`}
        >
          <span>User Accounts & Bans</span>
          <span className="px-1.5 py-0.5 rounded-full glass-1 text-text-secondary text-[9px]">{users.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 transition flex items-center gap-1.5 ${activeTab === 'reports' ? 'text-primary border-b-2 border-primary' : 'hover:text-primary-navy'}`}
        >
          <span>Reports & Moderation</span>
          {reports.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-functional-error text-white text-[9px]">{reports.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`pb-3 transition flex items-center gap-1.5 ${activeTab === 'tickets' ? 'text-primary border-b-2 border-primary' : 'hover:text-primary-navy'}`}
        >
          <span>Support Tickets Queue</span>
          {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px] font-bold">
              {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: KYC VERIFICATION QUEUE
         ========================================================================= */}
      {activeTab === 'kyc' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-primary-navy">Identity Document Verification Queue</h3>
              <p className="text-xs text-text-secondary">
                Review official government ID and selfie proofs to grant verified trust badges.
              </p>
            </div>
            <span className="text-xs font-bold text-primary px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
              {kycQueue.length} Pending Approval
            </span>
          </div>

          {kycQueue.length === 0 ? (
            <div className="p-12 text-center glass-1 rounded-3xl border border-white/60">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-text-primary">All caught up!</p>
              <p className="text-xs text-text-secondary mt-1">There are no pending KYC identity verifications.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {kycQueue.map((item) => (
                <div key={item.id} className="glass-2 p-6 rounded-3xl border border-white/80 space-y-4 shadow-glass-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-text-primary text-sm">{item.full_name || 'SkipIt Member'}</h4>
                      <p className="text-xs text-text-secondary">
                        {item.phone || item.email || 'No phone'} • {item.location || 'Bengaluru'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-50 text-functional-warning rounded-full border border-amber-200 uppercase">
                      {item.kyc_document_type || 'ID Card'}
                    </span>
                  </div>

                  {/* Document & Selfie previews with expiring signed URLs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Government ID (5m Signed URL)
                      </span>
                      {(kycSignedUrls[item.id]?.document_url || item.kyc_document_url) ? (
                        <div
                          onClick={() => setSelectedImage(kycSignedUrls[item.id]?.document_url || item.kyc_document_url)}
                          className="aspect-[4/3] rounded-xl overflow-hidden glass-1 border border-slate-200 cursor-pointer relative group"
                        >
                          <img
                            src={kycSignedUrls[item.id]?.document_url || item.kyc_document_url}
                            alt="KYC ID"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-bold gap-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Expand</span>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-[4/3] rounded-xl glass-1 flex items-center justify-center text-xs text-text-muted">
                          No document
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Live Selfie (5m Signed URL)
                      </span>
                      {(kycSignedUrls[item.id]?.selfie_url || item.kyc_selfie_url) ? (
                        <div
                          onClick={() => setSelectedImage(kycSignedUrls[item.id]?.selfie_url || item.kyc_selfie_url)}
                          className="aspect-[4/3] rounded-xl overflow-hidden glass-1 border border-slate-200 cursor-pointer relative group"
                        >
                          <img
                            src={kycSignedUrls[item.id]?.selfie_url || item.kyc_selfie_url}
                            alt="Selfie"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-bold gap-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Expand</span>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-[4/3] rounded-xl glass-1 flex items-center justify-center text-xs text-text-muted border border-dashed border-slate-300">
                          Optional Selfie
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Review Actions */}
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-200/50">
                    <button
                      onClick={() => handleReviewKyc(item.id, 'approved')}
                      className="flex-1 py-2.5 liquid-blue-gradient text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 hover:scale-[1.01]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Identity</span>
                    </button>
                    <button
                      onClick={() => handleReviewKyc(item.id, 'rejected')}
                      className="flex-1 py-2.5 glass-1 hover:bg-rose-50 text-functional-error font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-rose-200"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: USER MANAGEMENT & BAN CONTROLS
         ========================================================================= */}
      {activeTab === 'users' && (
        <div className="glass-2 rounded-3xl border border-white/80 overflow-hidden shadow-glass-sm animate-fade-in space-y-4 p-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, email, or phone..."
                className="w-full pl-10 pr-4 py-2 glass-1 rounded-xl text-xs focus:border-primary outline-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-text-muted text-[11px]">Filter:</span>
              <button
                onClick={() => setUserStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  userStatusFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'glass-1 text-text-secondary'
                }`}
              >
                All ({users.length})
              </button>
              <button
                onClick={() => setUserStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  userStatusFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'glass-1 text-text-secondary'
                }`}
              >
                Active ({users.filter((u) => !u.is_banned).length})
              </button>
              <button
                onClick={() => setUserStatusFilter('banned')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  userStatusFilter === 'banned' ? 'bg-rose-600 text-white shadow-xs' : 'glass-1 text-text-secondary'
                }`}
              >
                Banned ({users.filter((u) => u.is_banned).length})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/60">
            <table className="w-full text-left text-xs">
              <thead className="glass-1 text-text-muted font-bold uppercase tracking-wider border-b border-slate-200/50">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Trust Score</th>
                  <th className="p-4">KYC</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Moderation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-muted">
                      No user accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:glass-1 transition">
                      <td className="p-4 font-bold text-text-primary flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-subtle text-primary flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                          {u.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <span>{u.full_name || 'Member'}</span>
                          {u.is_verified && (
                            <span className="ml-1.5 text-[10px] text-primary font-bold">✓ Verified</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-text-secondary">{u.email || u.phone || 'N/A'}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-primary-subtle text-primary border border-blue-200'
                              : 'glass-1 text-text-secondary'
                          }`}
                        >
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-primary">{u.trust_score || 50}/100</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.kyc_status === 'approved'
                              ? 'bg-emerald-50 text-functional-success'
                              : u.kyc_status === 'pending'
                              ? 'bg-amber-50 text-functional-warning'
                              : 'glass-1 text-text-muted'
                          }`}
                        >
                          {u.kyc_status || 'none'}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.is_banned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-functional-error bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <ShieldAlert className="w-3 h-3" />
                            BANNED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-functional-success bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {u.id === adminUser?.id || u.role === 'admin' ? (
                          <span className="text-[10px] font-bold text-text-muted px-2.5 py-1 glass-1 rounded-xl border border-slate-200">
                            Admin Protected
                          </span>
                        ) : u.is_banned ? (
                          <button
                            onClick={() => executeToggleBan(u.id, false, 'Reinstated by admin')}
                            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-functional-success hover:bg-emerald-100 transition border border-emerald-200 shadow-xs"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Unban User</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setBanModalUser(u)}
                            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-50 text-functional-error hover:bg-rose-100 transition border border-rose-200 shadow-xs"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Ban User</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: REPORTS
         ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-primary-navy">User & Listing Reports</h3>
            <span className="text-xs text-text-secondary">{reports.length} open reports</span>
          </div>

          {reports.length === 0 ? (
            <div className="p-12 text-center glass-1 rounded-3xl border border-white/60">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-text-primary">No open reports</p>
              <p className="text-xs text-text-secondary mt-1">Marketplace safety reports are cleared.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="glass-2 p-5 rounded-2xl border border-white/80 flex items-start justify-between gap-4 shadow-glass-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-rose-50 text-functional-error font-bold text-[10px] rounded-full uppercase border border-rose-200">
                        {rep.reason}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(rep.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-text-primary font-medium mt-2">
                      {rep.description || 'No additional comment provided.'}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">Listing ID: {rep.listing_id || 'N/A'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResolveReport(rep.id, 'resolved')}
                      className="px-3.5 py-1.5 liquid-blue-gradient text-white font-bold text-xs rounded-xl shadow-xs hover:scale-[1.01]"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleResolveReport(rep.id, 'dismissed')}
                      className="px-3.5 py-1.5 glass-1 text-text-secondary font-bold text-xs rounded-xl hover:bg-slate-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: SUPPORT TICKETS QUEUE
         ========================================================================= */}
      {activeTab === 'tickets' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-primary-navy">Support Tickets Moderation Queue</h3>
              <p className="text-xs text-text-secondary">
                Manage user support inquiries, disputes, and assign status or moderator notes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
                className="px-3 py-1.5 glass-1 rounded-xl text-xs font-semibold outline-none focus:border-primary"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={ticketPriorityFilter}
                onChange={(e) => setTicketPriorityFilter(e.target.value)}
                className="px-3 py-1.5 glass-1 rounded-xl text-xs font-semibold outline-none focus:border-primary"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div className="p-12 text-center glass-1 rounded-3xl border border-white/60">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-text-primary">No support tickets</p>
              <p className="text-xs text-text-secondary mt-1">There are no open customer tickets at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets
                .filter((t) => (ticketStatusFilter === 'all' ? true : t.status === ticketStatusFilter))
                .filter((t) => (ticketPriorityFilter === 'all' ? true : t.priority === ticketPriorityFilter))
                .map((ticket) => (
                  <div
                    key={ticket.id}
                    className="glass-2 p-5 rounded-3xl border border-white/80 shadow-glass-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ticket.status === 'resolved' || ticket.status === 'closed'
                              ? 'bg-emerald-50 text-functional-success border border-emerald-200'
                              : ticket.status === 'in_progress'
                              ? 'bg-blue-50 text-primary border border-blue-200'
                              : 'bg-amber-50 text-functional-warning border border-amber-200'
                          }`}
                        >
                          {ticket.status}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ticket.priority === 'urgent'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : ticket.priority === 'high'
                              ? 'bg-amber-50 text-amber-600 border border-amber-200'
                              : 'glass-1 text-text-secondary'
                          }`}
                        >
                          {ticket.priority} priority
                        </span>

                        <span className="text-[11px] text-text-muted">
                          Ticket ID: <code className="font-mono text-text-primary">{ticket.id.slice(0, 8)}</code>
                        </span>
                      </div>

                      <span className="text-[11px] text-text-muted">
                        Submitted: {new Date(ticket.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-text-primary text-sm">{ticket.subject}</h4>
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed whitespace-pre-wrap">
                        {ticket.description}
                      </p>
                    </div>

                    {ticket.admin_notes && (
                      <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs space-y-1">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                          Current Admin Notes
                        </span>
                        <p className="text-xs text-text-primary">{ticket.admin_notes}</p>
                      </div>
                    )}

                    {/* Ticket Controls */}
                    <div className="pt-3 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-text-muted">Change Status:</span>
                        {(['open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
                          <button
                            key={st}
                            disabled={ticket.status === st}
                            onClick={() => handleUpdateTicket(ticket.id, { status: st })}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase transition ${
                              ticket.status === st
                                ? 'bg-primary text-white shadow-xs'
                                : 'glass-1 hover:glass-2 text-text-secondary'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newNotes = prompt('Enter admin response / moderation notes:', ticket.admin_notes || '');
                            if (newNotes !== null) {
                              handleUpdateTicket(ticket.id, { admin_notes: newNotes });
                            }
                          }}
                          className="px-3 py-1.5 liquid-blue-gradient text-white font-bold text-xs rounded-xl shadow-xs"
                        >
                          Add / Edit Notes
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: OVERVIEW & SYSTEM METRICS
         ========================================================================= */}
      {activeTab === 'metrics' && (
        <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 space-y-6 shadow-glass-sm animate-fade-in">
          <div>
            <h3 className="text-base font-bold text-primary-navy">SkipIt Trust & Infrastructure Status</h3>
            <p className="text-xs text-text-secondary mt-1">
              Architecture verified with zero-commission peer-to-peer rental protocol.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 glass-1 rounded-2xl border border-white/60">
              <span className="text-xs font-bold text-text-muted block mb-1">Fee Model</span>
              <span className="text-sm font-black text-primary">0% Free P2P (No Gateway)</span>
            </div>
            <div className="p-4 glass-1 rounded-2xl border border-white/60">
              <span className="text-xs font-bold text-text-muted block mb-1">Authentication</span>
              <span className="text-sm font-black text-primary-navy">Google Sign-In + Email (Zero SMS Cost)</span>
            </div>
            <div className="p-4 glass-1 rounded-2xl border border-white/60">
              <span className="text-xs font-bold text-text-muted block mb-1">Design System</span>
              <span className="text-sm font-black text-primary">Liquid Glass & Glassmorphism</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          BAN USER CONFIRMATION MODAL
         ========================================================================= */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-navy/40 backdrop-blur-md animate-fade-in">
          <div className="glass-3 rounded-3xl max-w-md w-full p-6 border border-white/90 shadow-glass-lg relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-functional-error flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <UserX className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-center text-primary-navy">
              Ban User Account
            </h3>
            <p className="text-xs text-center text-text-secondary mt-1">
              Suspending <strong className="text-text-primary">{banModalUser.full_name || banModalUser.email}</strong> will
              immediately deactivate their listings and block them from logging in.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">Reason for Suspension</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  rows={3}
                  className="w-full p-3 glass-1 rounded-xl text-xs focus:border-primary outline-none"
                  placeholder="Specify violation details..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBanModalUser(null)}
                  className="flex-1 py-2.5 glass-1 text-xs font-bold text-text-secondary rounded-xl hover:text-text-primary transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => executeToggleBan(banModalUser.id, true, banReason)}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-rose-600/25"
                >
                  Confirm Ban
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HIGH-RES DOCUMENT VIEWER MODAL
         ========================================================================= */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Expanded Doc" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full transition"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
