'use client';

import React from 'react';
import { Receipt, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-asphalt text-white font-sans selection:bg-safety-orange selection:text-white">

      {/* Navbar */}
      <nav className="border-b border-edge-steel bg-asphalt/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight flex items-center gap-2">
            <Receipt className="text-safety-orange" size={24} />
            itemize-it
          </Link>
          <Link href="/" className="text-sm font-medium text-concrete hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-concrete mb-12">Effective Date: January 28, 2026</p>

        <div className="space-y-10 text-concrete leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using the Itemize-It mobile application and web services (the &quot;Service&quot;),
              you agree to be bound by these Terms of Service (&quot;Terms&quot;). The Service is operated by
              Powerplay Systems Inc. (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), a company incorporated in Ontario, Canada.
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
            <p>
              Itemize-It is an expense organization tool designed for contractors, consultants, and solo operators.
              The Service allows you to capture receipts, classify line items as business or personal expenses,
              assign costs to projects or clients, and export organized data. The Service is not accounting software
              and does not provide tax, legal, or financial advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Accounts</h2>
            <div className="space-y-4">
              <p>
                You must create an account to use the Service. You are responsible for maintaining the confidentiality
                of your account credentials and for all activity that occurs under your account.
              </p>
              <p>
                You must provide accurate and complete information when creating your account. You agree to
                promptly update your information if it changes. You must be at least 18 years of age to create an account.
              </p>
              <p>
                We reserve the right to suspend or terminate accounts that violate these Terms or are inactive
                for more than 12 consecutive months.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="space-y-2">
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Use the Service for any unlawful purpose or to process fraudulent documents</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Upload content that infringes on the rights of others</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Attempt to gain unauthorized access to other users&apos; data or business workspaces</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Use automated scripts, bots, or scrapers to access the Service</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Abuse the email forwarding feature to route non-receipt content through our servers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Your Data</h2>
            <div className="space-y-4">
              <p>
                You retain ownership of all receipt images, line item data, project names, classification rules,
                and any other content you upload or create within the Service (&quot;Your Data&quot;). We do not claim
                any ownership over Your Data.
              </p>
              <p>
                You grant us a limited licence to process, store, and display Your Data solely to provide
                the Service to you. This includes transmitting receipt images to AI processing providers for
                text extraction and classification suggestions.
              </p>
              <p>
                You are responsible for ensuring you have the right to upload any content to the Service.
                You may export Your Data at any time using the built-in CSV export feature.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. AI-Powered Features</h2>
            <p>
              The Service uses artificial intelligence to extract text from receipt images and suggest expense
              classifications. AI outputs are provided as suggestions only and may contain errors.
              You are responsible for reviewing and approving all classifications before relying on them
              for tax, accounting, or any other purpose. We make no warranty regarding the accuracy
              of AI-generated extractions or suggestions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Subscriptions &amp; Billing</h2>
            <div className="space-y-4">
              <p>
                The Service offers free and paid subscription tiers. Paid subscriptions are billed monthly
                or annually as selected at the time of purchase. All amounts are in Canadian dollars (CAD)
                unless otherwise stated.
              </p>
              <p>
                You may cancel your subscription at any time. Cancellation takes effect at the end of the
                current billing period. We do not provide prorated refunds for partial billing periods.
              </p>
              <p>
                We reserve the right to change pricing with 30 days&apos; notice. Continued use of the Service
                after a price change constitutes acceptance of the new pricing.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access to the Service.
              We may perform scheduled maintenance, deploy updates, or experience outages beyond our control.
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We are not liable for any
              data loss resulting from service interruptions — the offline queue feature is provided as a
              convenience, not a guarantee.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Powerplay Systems Inc. shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not limited to
              loss of profits, data, or business opportunities, arising out of or in connection with your use
              of the Service. Our total liability for any claim arising from the Service shall not exceed the
              amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Disclaimer</h2>
            <p>
              The Service is an expense organization tool only. It is not a substitute for professional
              accounting, tax preparation, or financial advice. You are solely responsible for the accuracy
              of your expense classifications and any tax filings or financial decisions based on data
              from the Service. We strongly recommend consulting a qualified accountant or tax professional.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Powerplay Systems Inc., its officers, directors,
              employees, and agents from any claims, damages, losses, or expenses (including legal fees)
              arising out of your use of the Service, violation of these Terms, or infringement of any
              third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">12. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time for violation of these Terms,
              with or without notice. Upon termination, your right to use the Service ceases immediately.
              You may request an export of Your Data within 30 days of termination, after which Your Data
              will be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">13. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the Province of Ontario
              and the federal laws of Canada applicable therein. Any disputes arising from these Terms or the
              Service shall be subject to the exclusive jurisdiction of the courts located in Toronto, Ontario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">14. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes via email
              or an in-app notice at least 14 days before the changes take effect. Continued use of the
              Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">15. Contact</h2>
            <p>
              For questions about these Terms:
            </p>
            <div className="mt-4 p-4 bg-gunmetal border border-edge-steel rounded-lg">
              <p className="text-white font-semibold">Powerplay Systems Inc.</p>
              <p>Toronto, Ontario, Canada</p>
              <p className="mt-2">
                <a href="mailto:legal@itemize-it.com" className="text-safety-orange hover:underline">legal@itemize-it.com</a>
              </p>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
