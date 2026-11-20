import React from 'react';
import Link from 'next/link';
import { AlertTriangle, HelpCircle, LifeBuoy, ShieldCheck, Mail } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-functional-warning">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <h1 className="text-sm font-bold uppercase tracking-wider">DRAFT - needs legal review</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Community guidelines and help articles draft for the SkipIt peer-to-peer equipment sharing marketplace.
          </p>
        </div>
      </div>

      <div className="glass-2 p-6 sm:p-8 rounded-3xl border border-white/80 space-y-6 text-text-primary text-xs sm:text-sm leading-relaxed">
        <h2 className="text-xl font-black text-primary-navy">SkipIt Help Center & Community Guidelines</h2>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">How does peer-to-peer renting work on SkipIt?</h3>
          <p>
            1. <strong>Find Gear:</strong> Browse cameras, drones, tools, and electronics in your city.
          </p>
          <p>
            2. <strong>Request Dates:</strong> Select your rental start and end dates. SkipIt automatically applies daily, weekly, or monthly tiered discounts.
          </p>
          <p>
            3. <strong>Host Acceptance:</strong> The owner reviews your request and accepts it.
          </p>
          <p>
            4. <strong>Direct Handover:</strong> Meet in person or arrange local handover. Test the equipment together. Settle any security deposit directly.
          </p>
          <p>
            5. <strong>Complete & Review:</strong> When the gear is returned safely, the owner marks the rental completed. Both parties can leave a verified review.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-sm text-primary-navy">How are identity documents handled under India DPDP rules?</h3>
          <p>
            All submitted identity documents are stored in private cloud storage and used solely for user verification. They are never shared publicly or sold. You can delete your account and all associated KYC records permanently via the Safety & Privacy tab.
          </p>
        </section>

        <section className="space-y-3 pt-4 border-t border-slate-200/50">
          <h3 className="font-bold text-sm text-primary-navy">Need personalized help?</h3>
          <p className="text-xs text-text-secondary">
            Our support desk is available to assist with rental inquiries, safety concerns, or listing questions.
          </p>
          <div className="flex gap-4">
            <Link
              href="/support"
              className="inline-flex items-center gap-2 px-5 py-2.5 liquid-blue-gradient text-white text-xs font-bold rounded-full shadow-md"
            >
              <LifeBuoy className="w-4 h-4" />
              <span>Open a Support Ticket</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
