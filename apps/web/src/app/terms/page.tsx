import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-functional-warning">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <h1 className="text-sm font-bold uppercase tracking-wider">DRAFT - needs legal review</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            This document is a preliminary operational draft for the SkipIt peer-to-peer rental marketplace and requires formal legal review before production deployment.
          </p>
        </div>
      </div>

      <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 space-y-6 text-text-primary text-xs sm:text-sm leading-relaxed">
        <h2 className="text-xl font-black text-primary-navy">SkipIt Peer-to-Peer Marketplace Terms of Service</h2>
        <p className="text-xs text-text-muted">Last modified: November 2026</p>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">1. Platform Role & Zero Platform Commission</h3>
          <p>
            SkipIt operates exclusively as an introductory discovery marketplace connecting independent equipment owners (&quot;Hosts&quot;) with prospective renters (&quot;Renters&quot;). SkipIt charges 0% platform commission on peer rentals. Handover, inspection, peer UPI / cash payment, and physical return are conducted directly between users.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">2. User Identification & India DPDP Act Consent</h3>
          <p>
            In compliance with the Digital Personal Data Protection (DPDP) Act, 2023 of India, users who voluntarily submit government identification documents (such as Aadhaar, Voter ID, Driver&apos;s License, or Passport) and verification selfies explicitly consent to the collection, cryptographic storage, and moderation processing of such data solely for peer fraud prevention, identity verification, and dispute resolution.
          </p>
          <p>
            Users maintain the right to withdraw consent and request permanent erasure of identity documents at any time by exercising the &quot;Delete Account&quot; function in their profile settings.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">3. Security Deposits & Peer Transactions</h3>
          <p>
            Any security deposit requested by a host is settled directly between the renter and host. SkipIt does not hold, escrow, or deduct funds. Both parties are encouraged to verify item condition thoroughly upon handover and return.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">4. Prohibited Items and User Conduct</h3>
          <p>
            Users agree not to list unlawful, hazardous, stolen, or restricted goods, and to adhere to community safety standards. SkipIt reserves the right to suspend or ban accounts that violate trust and safety policies.
          </p>
        </section>
      </div>
    </div>
  );
}
