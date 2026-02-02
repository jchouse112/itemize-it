'use client';

import React from 'react';
import { Receipt } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-edge-steel bg-asphalt">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">

          {/* Column 1: Brand */}
          <div>
            <Link href="/" className="font-bold text-xl tracking-tight flex items-center gap-2 mb-4">
              <Receipt className="text-safety-orange" size={24} />
              itemize-it
            </Link>
            <p className="text-sm text-concrete leading-relaxed mb-6">
              Expense organization for contractors, consultants, and solo operators.
            </p>
            <div className="flex gap-2 max-w-sm">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-gunmetal border border-edge-steel rounded px-3 h-10 text-sm text-white placeholder-concrete focus:border-safety-orange focus:outline-none transition-colors"
              />
              <button className="h-10 px-4 bg-safety-orange text-white text-sm font-semibold rounded hover:bg-[#E05000] transition-colors whitespace-nowrap">
                Early Access
              </button>
            </div>
          </div>

          {/* Column 2: Product */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-concrete mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/#how-it-works" className="text-sm text-concrete hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/#pricing" className="text-sm text-concrete hover:text-white transition-colors">Pricing</Link></li>
              <li><span className="text-sm text-concrete/50">Download App <span className="text-xs ml-1">(Coming Soon)</span></span></li>
              <li><Link href="/auth/login" className="text-sm text-concrete hover:text-white transition-colors">Sign In</Link></li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-concrete mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-sm text-concrete hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-concrete hover:text-white transition-colors">Terms of Service</Link></li>
              <li><a href="mailto:support@itemize-it.com" className="text-sm text-concrete hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-edge-steel">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-concrete opacity-50">
            &copy; {new Date().getFullYear()} Powerplay Systems Inc. Toronto, ON.
          </p>
          <p className="text-xs text-concrete opacity-30">
            A Powerplay Systems product.
          </p>
        </div>
      </div>
    </footer>
  );
}
