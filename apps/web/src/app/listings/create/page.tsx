'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function CreateListingPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState('good');
  const [pricePerDay, setPricePerDay] = useState('');
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('0');
  const [locationName, setLocationName] = useState('Bengaluru, Indiranagar');
  const [minDays, setMinDays] = useState('1');
  const [maxDays, setMaxDays] = useState('30');
  const [rentalTerms, setRentalTerms] = useState('Valid government ID required upon handover. Equipment to be returned in same clean working condition.');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('skipit_token');
    if (!token) {
      alert('Please sign in to publish a rental listing');
      router.push('/');
      return;
    }

    api.getCategories().then((res) => {
      if (res?.categories && res.categories.length > 0) {
        setCategories(res.categories);
        setCategory(res.categories[0].name);
      }
    });
  }, [router]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const newFiles = [...files, ...selected].slice(0, 6);
      setFiles(newFiles);
      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
      setPreviews(newPreviews);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title || !description || !pricePerDay || !category || !locationName) {
      setError('Please fill in all mandatory fields (Title, Description, Category, Daily Price, Location).');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('price_per_day', pricePerDay);
      formData.append('deposit_amount', requiresDeposit ? (depositAmount || '0') : '0');
      formData.append('condition', condition);
      formData.append('location_name', locationName);
      formData.append('min_rental_days', minDays);
      formData.append('max_rental_days', maxDays);
      formData.append('rental_terms', rentalTerms);
      if (brand) formData.append('brand', brand);
      if (model) formData.append('model', model);

      files.forEach((file) => {
        formData.append('images', file);
      });

      const res = await api.createListing(formData);
      if (res?.listing) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/listings/${res.listing.id}`);
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <span className="text-xs font-extrabold uppercase tracking-wider text-primary bg-primary-subtle/80 px-3 py-1 rounded-full">
          0% Platform Commission
        </span>
        <h1 className="text-3xl font-black text-primary-navy tracking-tight mt-2">
          List an Item for Rent
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Make your equipment work for you. Earn passive income from verified renters.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-functional-error text-xs rounded-2xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-functional-success text-sm rounded-2xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Listing published successfully! Redirecting...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 glass-2 p-6 sm:p-10 rounded-3xl border border-white/80 shadow-glass-md">
        {/* Section 1: Item Images */}
        <div>
          <label className="block text-sm font-bold text-text-primary mb-1">
            Item Photos <span className="text-text-muted font-normal text-xs">(Up to 6 photos)</span>
          </label>
          <p className="text-xs text-text-secondary mb-3">
            Clear, realistic photos build trust with prospective renters.
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {previews.map((src, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden glass-1 border border-white/80 group shadow-xs">
                <img src={src} alt="Upload preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {previews.length < 6 && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary glass-1 hover:glass-2 flex flex-col items-center justify-center cursor-pointer transition text-center p-2 group">
                <Upload className="w-5 h-5 text-text-muted group-hover:text-primary mb-1" />
                <span className="text-[10px] font-bold text-text-secondary group-hover:text-primary">Add Photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Section 2: Basic Details */}
        <div className="space-y-4 pt-6 border-t border-slate-200/50">
          <h2 className="text-base font-bold text-primary-navy">Basic Details</h2>

          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Listing Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sony Alpha A7 IV Camera with 24-70mm GM Lens"
              className="w-full px-4 py-2.5 glass-1 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 glass-1 rounded-xl text-xs font-semibold text-text-primary outline-none focus:glass-3 focus:ring-2 focus:ring-primary/20"
                required
              >
                {categories.map((c) => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Product Condition *</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full p-2.5 glass-1 rounded-xl text-xs font-semibold text-text-primary outline-none focus:glass-3 focus:ring-2 focus:ring-primary/20"
              >
                <option value="brand_new">Brand New (Unused / In Box)</option>
                <option value="like_new">Like New (Mint Condition)</option>
                <option value="good">Good (Light Wear, Fully Functional)</option>
                <option value="fair">Fair (Visible Wear, Fully Functional)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Brand (Optional)</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Sony, Apple, DeWalt"
                className="w-full px-4 py-2.5 glass-1 rounded-xl text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Model (Optional)</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. ILCE-7M4, M3 Pro"
                className="w-full px-4 py-2.5 glass-1 rounded-xl text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Detailed Description *</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe accessories included, specifications, and care instructions..."
              className="w-full p-3 glass-1 rounded-xl text-sm outline-none focus:border-primary resize-none"
              required
            />
          </div>
        </div>

        {/* Section 3: Pricing & Deposit */}
        <div className="space-y-4 pt-6 border-t border-slate-200/50">
          <h2 className="text-base font-bold text-primary-navy">Pricing & Handover</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Rental Rate per Day (₹) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-muted text-sm">₹</span>
                <input
                  type="number"
                  value={pricePerDay}
                  onChange={(e) => setPricePerDay(e.target.value)}
                  placeholder="800"
                  className="w-full pl-8 pr-4 py-2.5 glass-1 rounded-xl text-sm font-bold focus:border-primary outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">Security Deposit Requirement</label>
              <div className="flex items-center gap-2 p-1.5 glass-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setRequiresDeposit(false);
                    setDepositAmount('0');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    !requiresDeposit ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  No Deposit (₹0)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequiresDeposit(true);
                    if (depositAmount === '0') setDepositAmount('1000');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    requiresDeposit ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Require Deposit
                </button>
              </div>
            </div>
          </div>

          {requiresDeposit && (
            <div className="p-4 bg-blue-50/60 border border-blue-200/70 rounded-2xl space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-primary-navy">
                  Refundable Security Deposit Amount (₹) *
                </label>
                <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-blue-100/60 rounded-full">
                  Settled P2P upon handover
                </span>
              </div>
              <div className="relative max-w-sm">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-muted text-sm">₹</span>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-primary outline-none"
                  required={requiresDeposit}
                />
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Renters will pay this deposit directly to you via UPI or cash when receiving the item, and you return it upon safe inspection at the end of the rental.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Pickup Location / City *</label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Indiranagar, Bengaluru"
                className="w-full pl-10 pr-4 py-2.5 glass-1 rounded-xl text-sm focus:border-primary outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Rental Terms & Care Instructions</label>
            <textarea
              rows={2}
              value={rentalTerms}
              onChange={(e) => setRentalTerms(e.target.value)}
              className="w-full p-2.5 glass-1 rounded-xl text-xs outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-slate-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-secondary text-xs">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>0% Commission: You keep 100% of rental earnings</span>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="px-8 py-3 liquid-blue-gradient text-white font-bold text-xs sm:text-sm rounded-full shadow-md shadow-primary/20 hover:scale-105 transition-transform"
          >
            {loading ? 'Publishing...' : 'Publish Listing'}
          </button>
        </div>
      </form>
    </div>
  );
}
