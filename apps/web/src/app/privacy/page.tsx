'use client';

import React from 'react';
import { Receipt, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-concrete mb-12">Effective Date: January 28, 2026</p>

        <div className="space-y-10 text-concrete leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Introduction</h2>
            <p>
              Itemize-It (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is operated by Powerplay Systems Inc., based in Toronto, Ontario, Canada.
              This Privacy Policy explains how we collect, use, and protect your information when you use the
              Itemize-It mobile application and web services (the &quot;Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-1">Account Information</h3>
                <p>Email address and password when you create an account.</p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Receipt Data</h3>
                <p>
                  Photos, PDFs, and email-forwarded receipts you submit for processing. This includes merchant names,
                  dates, item descriptions, amounts, and any classifications you apply (business or personal).
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Business Information</h3>
                <p>
                  Business name, tax jurisdiction, and project/client names you create within the Service.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Device &amp; Usage Data</h3>
                <p>
                  Device type, operating system, app version, and general usage patterns to improve the Service.
                  We do not collect precise GPS location.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="space-y-2">
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> To process and extract data from your receipts using AI/OCR</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> To provide classification suggestions based on your past patterns</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> To generate exports and reports you request</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> To send transactional notifications (receipt processed, items ready for review)</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> To improve the Service and fix bugs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Isolation &amp; Security</h2>
            <p className="mb-4">
              Your data is stored in dedicated, isolated database tables with row-level security (RLS) policies.
              Each business workspace is fully separated at the database level — no other user or business can
              access your data, even in the event of an application-level bug.
            </p>
            <p>
              All data is encrypted in transit (TLS) and at rest. Receipt images are stored in isolated
              storage paths scoped to your business ID. We use Supabase infrastructure hosted in North America.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. AI Processing</h2>
            <p>
              Receipt images may be processed by third-party AI services (OpenAI) to extract text and suggest
              classifications. We send only the receipt image and extracted text — never your account credentials,
              business name, or personal identifiers. AI providers do not retain your data for training purposes
              under our data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Email Forwarding</h2>
            <p>
              If you use the email forwarding feature (your <span className="text-white font-mono">@2itm.com</span> alias),
              forwarded emails are processed to extract receipt attachments. The email body and attachments are
              stored temporarily for processing, then only the extracted receipt data and images are retained.
              We do not read or store non-receipt email content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Data Sharing</h2>
            <p>We do not sell your data. We share information only with:</p>
            <ul className="space-y-2 mt-3">
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> <strong className="text-white">Infrastructure providers</strong> (Supabase, Vercel) to operate the Service</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> <strong className="text-white">AI providers</strong> (OpenAI) for receipt extraction, under data processing agreements</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> <strong className="text-white">Law enforcement</strong> only when required by Canadian law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Data Retention &amp; Deletion</h2>
            <p>
              Your receipt data is retained for as long as your account is active. You can export all your data
              at any time via the CSV export feature. Upon account deletion, all your data — including receipt
              images, line items, projects, and classification rules — is permanently deleted within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Your Rights</h2>
            <p className="mb-3">Under Canadian privacy law (PIPEDA) and applicable provincial legislation, you have the right to:</p>
            <ul className="space-y-2">
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Access all personal data we hold about you</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Request correction of inaccurate data</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Request deletion of your account and all associated data</li>
              <li className="flex gap-3"><span className="text-safety-orange mt-1.5 shrink-0">&bull;</span> Export your data in a portable format (CSV)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. We will notify you of material changes via email
              or an in-app notice. Continued use of the Service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">11. Contact</h2>
            <p>
              For privacy inquiries, data requests, or concerns:
            </p>
            <div className="mt-4 p-4 bg-gunmetal border border-edge-steel rounded-lg">
              <p className="text-white font-semibold">Powerplay Systems Inc.</p>
              <p>Toronto, Ontario, Canada</p>
              <p className="mt-2">
                <a href="mailto:privacy@itemize-it.com" className="text-safety-orange hover:underline">privacy@itemize-it.com</a>
              </p>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
