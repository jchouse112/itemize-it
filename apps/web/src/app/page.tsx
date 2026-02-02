'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, Layers, Receipt, Hammer, Briefcase, Plane, ScanLine, Split, BarChart3, XCircle, Shield, Clock, AlertTriangle, Copy, Bell, FileText } from 'lucide-react';
import Footer from '@/components/Footer';

// --- DATA: Use Cases (Refined for "Organization First") ---
const USE_CASES = {
  contractor: {
    id: 'contractor',
    label: 'Contractors & Trades',
    icon: Hammer,
    headline: <>Mixed receipts, <span className="text-concrete">instantly organized.</span></>,
    sub: 'One receipt covers multiple jobs. Personal and business spend get mixed. Split it cleanly in seconds.',
    demo: {
      total: '$482.50',
      action: 'SPLIT TO JOBS',
      badge: { label: 'Personal Flagged', value: '$99.00' },
      items: [
        { name: '2x4 Pressure Treated', meta: 'Miller Reno', price: '$142.50', type: 'project' },
        { name: 'Dewalt 20V Battery', meta: 'Business Asset', price: '$99.00', type: 'asset' },
        { name: 'Red Bull 4-Pack', meta: 'Personal', price: '$8.99', type: 'personal' },
      ]
    }
  },
  consultant: {
    id: 'consultant',
    label: 'Consultants & Freelancers',
    icon: Plane,
    headline: <>Separate client spend <span className="text-concrete">from personal life.</span></>,
    sub: 'Track travel, subscriptions, and reimbursables without the spreadsheet headache.',
    demo: {
      total: '$612.00',
      action: 'ORGANIZE FOLIO',
      badge: { label: 'Reimbursable Found', value: '$45.00' },
      items: [
        { name: 'Room Charge 1 Night', meta: 'Acme Corp', price: '$450.00', type: 'project' },
        { name: 'Room Service (Dinner)', meta: 'Acme Corp', price: '$45.00', type: 'project' },
        { name: 'In-Room Movie', meta: 'Personal', price: '$18.99', type: 'personal' },
      ]
    }
  },
  professional: {
    id: 'professional',
    label: 'Professionals',
    icon: Briefcase,
    headline: <>Capture every <span className="text-concrete">shared cost.</span></>,
    sub: 'Don\'t let disbursement costs hide in general overhead. Assign expenses to matters instantly.',
    demo: {
      total: '$124.50',
      action: 'ASSIGN MATTERS',
      badge: { label: 'Billable Recovered', value: '$84.00' },
      items: [
        { name: 'Xerox Paper (Case)', meta: 'Smith v. Jones', price: '$84.00', type: 'project' },
        { name: 'Breakroom Coffee', meta: 'Firm Overhead', price: '$22.50', type: 'personal' },
        { name: 'Court Courier', meta: 'Smith v. Jones', price: '$18.00', type: 'project' },
      ]
    }
  }
};

// --- COMPONENT: How It Works ---
const STEPS = [
  {
    num: '01',
    icon: ScanLine,
    title: 'Capture',
    desc: 'Snap a photo, forward an email, or drop a PDF. AI extracts every line item, amount, and merchant automatically.',
  },
  {
    num: '02',
    icon: Split,
    title: 'Organize',
    desc: 'Swipe to classify business vs. personal. Split items across jobs. Auto-rules learn your patterns over time.',
  },
  {
    num: '03',
    icon: Shield,
    title: 'Protect',
    desc: 'Warranties tracked. Return deadlines monitored. Duplicates caught. Your purchases are covered, automatically.',
  },
  {
    num: '04',
    icon: FileText,
    title: 'Export',
    desc: 'Clean CSV, accountant-ready packs, and tax summaries — on demand. Your data, organized and ready to go.',
  }
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-asphalt border-t border-edge-steel relative overflow-hidden scroll-mt-16">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <h2 className="text-3xl font-bold mb-4 text-center">
          Expense tracking, the way <span className="text-concrete">job-based work happens.</span>
        </h2>
        <p className="text-concrete text-center mb-16 max-w-xl mx-auto">From receipt to tax-ready export — everything happens automatically.</p>

        <div className="grid md:grid-cols-4 gap-6 relative">
          <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-edge-steel z-0" />
          {STEPS.map((step, i) => (
            <div key={i} className="relative z-10 bg-asphalt p-6 border border-edge-steel rounded-xl text-center md:text-left">
              <div className="w-12 h-12 bg-gunmetal border border-edge-steel rounded-full flex items-center justify-center text-safety-orange font-mono font-bold text-lg mb-6 shadow-[0_0_15px_rgba(255,95,0,0.2)] mx-auto md:mx-0 relative">
                <step.icon size={20} className="absolute opacity-20" />
                <span className="relative z-10">{step.num}</span>
              </div>
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-concrete text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- COMPONENT: Pricing ---
function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-gunmetal border-t border-edge-steel scroll-mt-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-4">Simple pricing for solo operators.</h2>
          <p className="text-concrete">No per-receipt fees. No lock-in. Export your data anytime.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto items-start">

          {/* Solo — Free */}
          <div className="p-6 bg-asphalt border border-edge-steel rounded-2xl flex flex-col group hover:border-concrete transition-colors">
            <div className="mb-3 text-concrete font-mono text-xs uppercase tracking-widest">Solo</div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-white tabular-nums">$0</span>
            </div>
            <p className="text-xs text-concrete mb-5">Free forever</p>
            <div className="text-[13px] text-white font-semibold mb-5 pb-5 border-b border-edge-steel">5 receipts / month</div>
            <ul className="space-y-2.5 mb-8 flex-1 text-[13px]">
              <li className="flex items-start gap-2 text-concrete"><Check size={14} className="text-white shrink-0 mt-[3px]"/>Swipe classify UI</li>
              <li className="flex items-start gap-2 text-concrete"><Check size={14} className="text-white shrink-0 mt-[3px]"/>AI line-item extraction</li>
              <li className="flex items-start gap-2 text-concrete"><Check size={14} className="text-white shrink-0 mt-[3px]"/>Basic tagging &amp; projects</li>
              <li className="flex items-start gap-2 text-concrete/50"><Check size={14} className="text-concrete/30 shrink-0 mt-[3px]"/>Watermarked PDF only</li>
            </ul>
            <button className="w-full h-11 border border-edge-steel text-white text-sm font-semibold rounded hover:bg-edge-steel transition-colors mt-auto">
              Start Free
            </button>
          </div>

          {/* Starter — $12/mo */}
          <div className="p-6 bg-asphalt border border-edge-steel rounded-2xl flex flex-col group hover:border-concrete transition-colors">
            <div className="mb-3 text-concrete font-mono text-xs uppercase tracking-widest">Starter</div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-white tabular-nums">$12</span>
              <span className="text-concrete text-sm"> /mo</span>
            </div>
            <p className="text-xs text-concrete mb-5">or $120/yr (save 17%)</p>
            <div className="text-[13px] text-white font-semibold mb-5 pb-5 border-b border-edge-steel">50 receipts / month</div>
            <ul className="space-y-2.5 mb-8 flex-1 text-[13px]">
              <li className="flex items-start gap-2 text-concrete"><Check size={14} className="text-white shrink-0 mt-[3px]"/>Everything in Solo</li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>CSV &amp; accountant export</b></li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>Auto-classify rules</b></li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/>Payment source toggle</li>
              <li className="flex items-start gap-2 text-concrete"><Check size={14} className="text-white shrink-0 mt-[3px]"/>1 business profile</li>
            </ul>
            <button className="w-full h-11 border border-edge-steel text-white text-sm font-semibold rounded hover:bg-edge-steel transition-colors mt-auto">
              Start 14-Day Trial
            </button>
          </div>

          {/* Pro — $29/mo (Most Popular) */}
          <div className="p-6 bg-gunmetal border-2 border-safety-orange rounded-2xl flex flex-col shadow-[0_0_30px_rgba(255,95,0,0.15)]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-safety-orange text-white px-3 py-1 text-[11px] font-bold uppercase rounded tracking-wider relative">
              Most Popular
            </div>
            <div className="mb-3 text-safety-orange font-mono text-xs uppercase tracking-widest">Pro</div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-white tabular-nums">$29</span>
              <span className="text-concrete text-sm"> /mo</span>
            </div>
            <p className="text-xs text-concrete mb-5">or $290/yr (save 17%)</p>
            <div className="text-[13px] text-white font-semibold mb-5 pb-5 border-b border-edge-steel">300 receipts / month</div>
            <ul className="space-y-2.5 mb-8 flex-1 text-[13px]">
              <li className="flex items-start gap-2 text-concrete"><Check size={14} className="text-white shrink-0 mt-[3px]"/>Everything in Starter</li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>Multiple businesses</b></li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>Priority AI processing</b></li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>Email forwarding</b></li>
              <li className="flex items-start gap-2 text-concrete/50"><Check size={14} className="text-concrete/30 shrink-0 mt-[3px]"/>QuickBooks/Xero <span className="text-[11px]">(soon)</span></li>
            </ul>
            <button className="w-full h-11 bg-safety-orange text-white text-sm font-semibold rounded hover:bg-[#E05000] transition-colors shadow-[0_0_20px_rgba(255,95,0,0.2)] mt-auto">
              Start 14-Day Trial
            </button>
            <p className="text-center text-[11px] text-concrete mt-3">Then $29/mo. Cancel anytime.</p>
          </div>

          {/* Team — $69/mo */}
          <div className="p-6 bg-asphalt border border-edge-steel rounded-2xl flex flex-col group hover:border-concrete transition-colors">
            <div className="mb-3 text-concrete font-mono text-xs uppercase tracking-widest">Team</div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-white tabular-nums">$69</span>
              <span className="text-concrete text-sm"> /mo</span>
            </div>
            <p className="text-xs text-concrete mb-5">$690/yr &middot; 3 seats included</p>
            <div className="text-[13px] text-white font-semibold mb-5 pb-5 border-b border-edge-steel">1,000 receipts / month pooled</div>
            <ul className="space-y-2.5 mb-8 flex-1 text-[13px]">
              <li className="flex items-start gap-2 text-concrete"><Check size={14} className="text-white shrink-0 mt-[3px]"/>Everything in Pro</li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>3 seats</b> <span className="text-concrete">+$15/seat</span></li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>Uploader &amp; reviewer roles</b></li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/><b>Audit trail</b></li>
              <li className="flex items-start gap-2 text-white"><Check size={14} className="text-safety-orange shrink-0 mt-[3px]"/>Shared projects</li>
            </ul>
            <button className="w-full h-11 border border-edge-steel text-white text-sm font-semibold rounded hover:bg-edge-steel transition-colors mt-auto">
              Contact Us
            </button>
          </div>

        </div>

        {/* Soft limit note */}
        <p className="text-center text-xs text-concrete/50 mt-8 max-w-lg mx-auto">
          Hit your receipt limit? We&apos;ll still process it — you just can&apos;t export until you upgrade or next month rolls over.
        </p>
      </div>
    </section>
  );
}

// --- COMPONENT: Lifecycle Features ---
const LIFECYCLE_FEATURES = [
  {
    icon: Shield,
    title: 'Warranty Tracking',
    desc: 'Automatically detects warranty-eligible purchases — tools, electronics, equipment. Tracks coverage dates and alerts you before expiry.',
    highlight: '112+ manufacturers recognized',
    color: 'text-safe',
  },
  {
    icon: Clock,
    title: 'Return Deadlines',
    desc: 'Calculates return windows for 30+ major retailers. Color-coded urgency alerts so you never miss a deadline.',
    highlight: 'Alerts 7 days before expiry',
    color: 'text-warn',
  },
  {
    icon: AlertTriangle,
    title: 'Recall Detection',
    desc: 'AI-powered product recall monitoring. If a tool or product you purchased gets recalled, you\u2019ll know immediately.',
    highlight: 'Automatic safety alerts',
    color: 'text-critical',
  },
  {
    icon: Copy,
    title: 'Duplicate Detection',
    desc: 'Fingerprints every receipt by merchant, date, total, and payment method. Catches double-scans and email+photo overlaps.',
    highlight: 'Prevents double-counting',
    color: 'text-safety-orange',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    desc: 'Proactive alerts for warranties expiring, return windows closing, and receipts ready for review. You set the preferences.',
    highlight: 'Customizable per type',
    color: 'text-safety-orange',
  },
  {
    icon: FileText,
    title: 'Accountant-Ready Export',
    desc: 'CSV, PDF, and tax summary exports filtered by date, project, or classification. Formatted for your accountant, not just for you.',
    highlight: 'IRS & CRA categories',
    color: 'text-safe',
  },
];

function LifecycleFeatures() {
  return (
    <section className="py-24 bg-gunmetal border-t border-edge-steel">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-4">More than classification. <span className="text-concrete">Full lifecycle protection.</span></h2>
          <p className="text-concrete">Every receipt you capture keeps working for you — tracking warranties, monitoring returns, and catching duplicates automatically.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LIFECYCLE_FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div key={i} className="p-6 bg-asphalt border border-edge-steel rounded-xl group hover:border-concrete transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gunmetal border border-edge-steel rounded-lg flex items-center justify-center shrink-0">
                    <Icon size={20} className={feat.color} />
                  </div>
                  <h3 className="text-white font-bold">{feat.title}</h3>
                </div>
                <p className="text-concrete text-sm leading-relaxed mb-4">{feat.desc}</p>
                <div className={`text-xs font-mono uppercase tracking-wider ${feat.color} opacity-80`}>
                  {feat.highlight}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --- COMPONENT: Objection Handling ---
function ObjectionHandling() {
  return (
    <section className="py-20 bg-asphalt border-t border-edge-steel">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <XCircle size={120} className="text-concrete" />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-6">What this isn't.</h3>
            <div className="grid md:grid-cols-2 gap-y-4 gap-x-12 text-concrete mb-8">
               <div className="flex items-center gap-3"><div className="w-2 h-2 bg-concrete rounded-full"></div> Not accounting software</div>
               <div className="flex items-center gap-3"><div className="w-2 h-2 bg-concrete rounded-full"></div> Not job management</div>
               <div className="flex items-center gap-3"><div className="w-2 h-2 bg-concrete rounded-full"></div> Not another spreadsheet</div>
            </div>
            <p className="text-lg text-white font-medium border-l-4 border-safety-orange pl-4">
              Itemize-it just keeps your expenses organized — everything else becomes easier.
            </p>
            <p className="text-sm text-concrete mt-6">
              Export clean, organized expenses anytime — no lock-in.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- COMPONENT: FAQ ---
const FAQ_ITEMS = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Solo plan is completely free — no card required. Paid plans include a 14-day free trial before billing begins.',
  },
  {
    q: 'What happens when I hit my receipt limit?',
    a: 'We never block you from uploading. Your receipt will still be processed and visible in the app. You just can\u2019t export until you upgrade or the next month starts.',
  },
  {
    q: 'Can I switch plans anytime?',
    a: 'Yes. Upgrade instantly, downgrade at the end of your billing cycle. No lock-in, no cancellation fees.',
  },
  {
    q: 'Is my data safe?',
    a: 'Your data is stored in isolated database tables with row-level security. Each business workspace is fully separated — no other user can access your receipts, even in the event of a bug. All data is encrypted in transit and at rest.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export everything via CSV at any time. After account deletion, all data is permanently removed within 30 days.',
  },
  {
    q: 'Does the AI see my personal information?',
    a: 'We send only the receipt image for text extraction — never your name, business name, or account details. Our AI provider (OpenAI) does not retain your data for training.',
  },
  {
    q: 'How does warranty tracking work?',
    a: 'When you scan a receipt, we automatically detect warranty-eligible items (tools, electronics, appliances) using a registry of 112+ manufacturers. Warranty dates, coverage details, and registration links are tracked for you — and we\u2019ll alert you 30 days before expiry.',
  },
  {
    q: 'Will I get notified about return deadlines?',
    a: 'Yes. We calculate return windows based on merchant-specific policies (Amazon, Home Depot, Costco, and 30+ others). You\u2019ll receive alerts 7 days before a return window closes, with color-coded urgency in the app.',
  },
  {
    q: 'What formats can I export?',
    a: 'Paid plans include CSV export, accountant-ready packs, and tax summaries organized by IRS (US) or CRA (Canada) categories. Filter by date range, project, or classification. The free plan includes watermarked PDF previews.',
  },
];

function FAQ() {
  return (
    <section id="faq" className="py-24 bg-asphalt border-t border-edge-steel scroll-mt-16">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold mb-4 text-center">Frequently asked questions.</h2>
        <p className="text-concrete text-center mb-12">Everything you need to know before getting started.</p>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group bg-gunmetal border border-edge-steel rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-white font-medium text-[15px] select-none hover:bg-edge-steel/30 transition-colors">
                {item.q}
                <span className="text-concrete ml-4 shrink-0 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <div className="px-6 pb-5 text-concrete text-sm leading-relaxed border-t border-edge-steel pt-4">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- COMPONENT: Final CTA ---
function FinalCTA() {
  return (
    <section className="py-24 bg-gunmetal border-t border-edge-steel relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
           style={{ backgroundImage: 'linear-gradient(#2A2F3A 1px, transparent 1px), linear-gradient(90deg, #2A2F3A 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />
      <div className="max-w-2xl mx-auto px-6 text-center relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to stop guessing <span className="text-concrete">at tax time?</span>
        </h2>
        <p className="text-concrete text-lg mb-8">
          Start organizing your expenses in under a minute. No credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input type="email" placeholder="Enter your email"
            className="flex-1 bg-asphalt border-2 border-edge-steel rounded-md px-4 h-14 text-white placeholder-concrete focus:border-safety-orange focus:outline-none transition-colors"
          />
          <button className="h-14 px-8 bg-safety-orange text-white font-semibold rounded-md hover:bg-[#E05000] active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_0_20px_rgba(255,95,0,0.2)]">
            Get Early Access <ArrowRight size={18} />
          </button>
        </div>
        <p className="mt-4 text-xs text-concrete opacity-60">
          Free plan available. No spam, ever.
        </p>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('contractor');
  const data = USE_CASES[activeTab as keyof typeof USE_CASES];

  return (
    <div className="min-h-screen bg-asphalt text-white font-sans selection:bg-safety-orange selection:text-white overflow-hidden">

      {/* Background Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-10"
           style={{ backgroundImage: 'linear-gradient(#2A2F3A 1px, transparent 1px), linear-gradient(90deg, #2A2F3A 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-edge-steel bg-asphalt/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight flex items-center gap-2">
            <Receipt className="text-safety-orange" size={24} />
            itemize-it
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-concrete hover:text-white transition-colors hidden sm:block">How It Works</a>
            <a href="#pricing" className="text-sm text-concrete hover:text-white transition-colors hidden sm:block">Pricing</a>
            <a href="#faq" className="text-sm text-concrete hover:text-white transition-colors hidden sm:block">FAQ</a>
            <a href="/auth/login" className="text-sm font-semibold text-safety-orange hover:text-white transition-colors">Sign In</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative z-10 pt-16 pb-24 max-w-6xl mx-auto px-6">

        {/* Use Case Tabs */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-12">
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {Object.values(USE_CASES).map((p) => {
                const isActive = activeTab === p.id;
                const Icon = p.icon;
                return (
                <button
                    key={p.id}
                    onClick={() => setActiveTab(p.id)}
                    className={`
                    flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-200
                    ${isActive
                        ? 'bg-safety-orange border-safety-orange text-white shadow-[0_0_15px_rgba(255,95,0,0.4)]'
                        : 'bg-gunmetal border-edge-steel text-concrete hover:border-concrete hover:text-white'}
                    `}
                >
                    <Icon size={16} />
                    {p.label}
                </button>
                );
            })}
            </div>
            {/* Contextual Helper Line */}
            <span className="text-xs text-concrete opacity-60 hidden md:block">Same workflow — different expense patterns.</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column: Text */}
          <motion.div
            key={data.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter leading-[1.1] mb-6 min-h-[140px]">
              {data.headline}
            </h1>
            <p className="text-xl text-concrete leading-relaxed mb-8 max-w-md min-h-[80px]">
              {data.sub}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-md">
              <input type="email" placeholder="Enter your email"
                className="flex-1 bg-gunmetal border-2 border-edge-steel rounded-md px-4 h-14 text-white placeholder-concrete focus:border-safety-orange focus:outline-none transition-colors tabular-nums"
              />
              <button className="h-14 px-8 bg-safety-orange text-white font-semibold rounded-md hover:bg-[#E05000] active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_0_20px_rgba(255,95,0,0.2)]">
                Get Early Access <ArrowRight size={18} />
              </button>
            </div>
            {/* Hero Clarifier */}
            <p className="mt-6 text-sm text-concrete flex items-center gap-2 opacity-80">
              <Check size={14} className="text-safety-orange" />
              Built for mixed receipts and messy real life.
            </p>
          </motion.div>

          {/* Right Column: Visual Demo */}
          <div className="relative perspective-1000">
            <motion.div
              className="bg-gunmetal border-4 border-edge-steel rounded-3xl p-6 shadow-2xl relative z-20"
              initial={{ rotateY: -5, rotateX: 5 }}
              animate={{ rotateY: 0, rotateX: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              whileHover={{ rotateY: -2, rotateX: 2 }}
            >
              <div className="flex justify-between items-center border-b border-edge-steel pb-4 mb-4">
                <div>
                  <div className="text-xs text-concrete uppercase tracking-widest mb-1 font-mono">Receipt Total</div>
                  <motion.div
                    key={`total-${data.id}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-bold tabular-nums"
                  >
                    {data.demo.total}
                  </motion.div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-concrete uppercase tracking-widest mb-1 font-mono">Status</div>
                  {/* Lower Anxiety Status */}
                  <div className="text-safety-orange text-sm font-bold animate-pulse">NEEDS SORTING</div>
                </div>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode='wait'>
                  {data.demo.items.map((item, index) => (
                    <motion.div
                      key={`${data.id}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`
                        flex items-center justify-between p-3 rounded border border-edge-steel
                        ${item.type === 'personal' ? 'opacity-50' : 'bg-asphalt'}
                      `}
                    >
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-concrete mt-1 flex items-center gap-1">
                          {item.type === 'project' && <span className="w-1.5 h-1.5 rounded-full bg-safe"></span>}
                          {item.type === 'asset' && <span className="w-1.5 h-1.5 rounded-full bg-warn"></span>}
                          {item.type === 'personal' && <span className="w-1.5 h-1.5 rounded-full bg-concrete"></span>}
                          <span className={item.type !== 'personal' ? 'text-white' : ''}>{item.meta}</span>
                        </div>
                      </div>
                      <div className="font-bold tabular-nums text-lg">{item.price}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-6 pt-4 border-t border-edge-steel">
                <button className="w-full h-12 bg-edge-steel hover:bg-concrete/20 text-white font-medium rounded flex items-center justify-center gap-2 transition-colors">
                  {data.demo.action}
                </button>
              </div>
            </motion.div>

            <motion.div
              key={`badge-${data.id}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="absolute -bottom-6 -left-6 bg-asphalt border border-edge-steel p-4 rounded-lg shadow-xl z-30"
            >
              <div className="text-xs text-concrete uppercase mb-1 font-bold">{data.demo.badge.label}</div>
              <div className="text-safe font-bold tabular-nums flex items-center gap-2 text-lg">
                <Check size={16} className="bg-safe text-asphalt rounded-full p-0.5" />
                {data.demo.badge.value}
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* The Problem (Inclusive Language) */}
      <section className="py-16 bg-gunmetal border-y border-edge-steel">
        <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-8">Expenses pile up. <span className="text-concrete">Clarity doesn't.</span></h2>
            <div className="grid sm:grid-cols-2 gap-6 text-left">
                <div className="p-4 bg-asphalt rounded border border-edge-steel text-concrete">
                    <span className="text-white font-bold block mb-1">• One receipt, multiple jobs or clients.</span>
                    Splitting costs across clients is manual hell.
                </div>
                <div className="p-4 bg-asphalt rounded border border-edge-steel text-concrete">
                    <span className="text-white font-bold block mb-1">• Personal & Business mixed.</span>
                    Buying a tool and a coffee on the same tap.
                </div>
                <div className="p-4 bg-asphalt rounded border border-edge-steel text-concrete">
                    <span className="text-white font-bold block mb-1">• "I'll do it later."</span>
                    Nightly bookkeeping never happens.
                </div>
                <div className="p-4 bg-asphalt rounded border border-edge-steel text-concrete">
                    <span className="text-white font-bold block mb-1">• Tax Time Panic.</span>
                    Guessing what you bought 8 months ago.
                </div>
            </div>
        </div>
      </section>

      {/* How It Works */}
      <HowItWorks />

      {/* Lifecycle Features */}
      <LifecycleFeatures />

      {/* Objection Handling */}
      <ObjectionHandling />

      {/* Pricing */}
      <Pricing />

      {/* FAQ */}
      <FAQ />

      {/* Final CTA */}
      <FinalCTA />

      <Footer />

    </div>
  );
}
