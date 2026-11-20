'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  Heart,
  MessageSquare,
  PlusCircle,
  User,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Bell,
  Sparkles,
  Package,
} from 'lucide-react';
import { api } from '@/lib/api';

interface NavbarProps {
  onOpenAuth: () => void;
}

export default function Navbar({ onOpenAuth }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState('Bengaluru');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('skipit_token');
    const storedUser = localStorage.getItem('skipit_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {}
    }

    if (token) {
      api.getMe()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem('skipit_user', JSON.stringify(res.user));
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/browse');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('skipit_token');
    localStorage.removeItem('skipit_user');
    setUser(null);
    setDropdownOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 px-4 sm:px-6 lg:px-8 pt-3 pb-2 transition-all">
      <div className="max-w-7xl mx-auto">
        {/* Floating Glass Navbar Container */}
        <div className="glass-2 rounded-2xl px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 transition-all">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl liquid-blue-gradient flex items-center justify-center text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
              <span className="font-black text-xl tracking-tighter">S</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-primary-navy group-hover:text-primary transition-colors">
                SkipIt
              </span>
              <span className="text-[10px] font-semibold text-text-secondary -mt-1 hidden sm:block">
                Skip Buying. Rent Smarter.
              </span>
            </div>
          </Link>

          {/* Location Selector (Glass Pill) */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 glass-1 hover:glass-2 rounded-full text-xs font-semibold text-text-primary cursor-pointer transition">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-transparent border-none outline-none cursor-pointer pr-1 text-text-primary font-medium"
            >
              <option value="Bengaluru">Bengaluru</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Delhi-NCR">Delhi-NCR</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="Pune">Pune</option>
              <option value="Chennai">Chennai</option>
            </select>
          </div>

          {/* Search Bar (Frosted Glass Input) */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search cameras, laptops, tools, gear..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 glass-1 focus:glass-3 rounded-full text-xs sm:text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </form>

          {/* Right Navigation CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/browse"
              className="text-xs sm:text-sm font-semibold text-text-secondary hover:text-primary transition px-2 py-1"
            >
              Explore
            </Link>

            {user ? (
              <>
                <Link
                  href="/messages"
                  className="p-2 text-text-secondary hover:text-primary hover:bg-primary-subtle/50 rounded-full transition relative"
                  title="Messages"
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>

                <Link
                  href="/profile?tab=wishlist"
                  className="p-2 text-text-secondary hover:text-functional-error hover:bg-rose-50/60 rounded-full transition relative"
                  title="Saved Items"
                >
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>

                {/* Post Item Primary CTA (Elevated Blue Liquid Glass) */}
                <Link
                  href="/listings/create"
                  className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 liquid-blue-gradient text-white text-xs sm:text-sm font-bold rounded-full shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all hover:scale-105"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>List Item</span>
                </Link>

                {/* User Menu Glass Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 p-1 glass-1 hover:glass-3 rounded-full transition"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary-subtle text-primary flex items-center justify-center font-bold text-xs overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                      ) : (
                        user.full_name?.charAt(0) || 'U'
                      )}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted mr-1" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 glass-3 rounded-2xl p-2 z-50 animate-fade-in border border-white/80">
                      <div className="px-3 py-2 border-b border-slate-100/60">
                        <p className="text-xs font-bold text-text-primary">{user.full_name || 'SkipIt Member'}</p>
                        <p className="text-[11px] text-text-secondary truncate">{user.phone || user.email}</p>
                        {user.is_verified && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-primary">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Verified Member</span>
                          </div>
                        )}
                      </div>

                      <Link
                        href="/rentals"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-primary-subtle/40 rounded-xl font-medium transition"
                      >
                        <Package className="w-3.5 h-3.5 text-primary" />
                        <span>Rental Bookings</span>
                      </Link>

                      <Link
                        href="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-primary-subtle/40 rounded-xl font-medium transition"
                      >
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>My Profile & Listings</span>
                      </Link>

                      <Link
                        href="/profile?tab=wishlist"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-primary-subtle/40 rounded-xl font-medium transition"
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <span>Saved Wishlist</span>
                      </Link>

                      <Link
                        href="/support"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-primary-subtle/40 rounded-xl font-medium transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Support & Helpdesk</span>
                      </Link>

                      {(user.role === 'admin' || user.role === 'moderator') && (
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-primary font-bold hover:bg-primary-subtle/60 rounded-xl transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Admin Portal</span>
                        </Link>
                      )}

                      <div className="border-t border-slate-100/60 my-1"></div>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-functional-error hover:bg-rose-50/50 rounded-xl font-medium text-left transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 px-5 py-2 liquid-blue-gradient text-white text-xs sm:text-sm font-bold rounded-full shadow-md shadow-primary/25 hover:shadow-lg transition-all hover:scale-105"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
