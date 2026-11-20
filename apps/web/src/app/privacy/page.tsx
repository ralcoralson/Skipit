import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-functional-warning">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <h1 className="text-sm font-bold uppercase tracking-wider">DRAFT - needs legal review</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            This privacy policy is a draft notice provided for transparency and compliance review under the Digital Personal Data Protection (DPDP) Act, 2023.
          </p>
        </div>
      </div>

      <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 space-y-6 text-text-primary text-xs sm:text-sm leading-relaxed">
        <h2 className="text-xl font-black text-primary-navy">SkipIt Privacy Policy & Data Processing Notice</h2>
        <p className="text-xs text-text-muted">Last modified: November 2026</p>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">1. Information We Collect</h3>
          <p>
            SkipIt collects minimal personal data required to enable peer-to-peer equipment sharing:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Contact Information: Phone number and email address (via OTP verification or Google OAuth).</li>
            <li>Profile Information: Name, optional avatar photo, city/location, and user bio.</li>
            <li>Identity Verification (KYC): Government ID cards and live selfies, provided voluntarily by users seeking verified status.</li>
            <li>Marketplace Activity: Listings created, rental booking requests, chat messages, and verified reviews.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">2. Digital Personal Data Protection (DPDP) Consent & Storage</h3>
          <p>
            By submitting verification documents, you give informed, explicit consent for SkipIt to store your identity files in a private, encrypted storage bucket. KYC documents are never made publicly accessible and are accessed only by authorized moderators through expiring signed URLs.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">3. Data Retention & Permanent Deletion</h3>
          <p>
            You may request the immediate and permanent deletion of your profile, personal data, and all uploaded KYC files at any time through the &quot;Safety &amp; Privacy&quot; tab in your profile dashboard or by contacting support.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">4. Contacting the Data Protection Officer</h3>
          <p>
            For privacy inquiries, rights under the DPDP Act, or data queries, submit a ticket via our Helpdesk Support portal.
          </p>
        </section>
      </div>
    </div>
  );
}
