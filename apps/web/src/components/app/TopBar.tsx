"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, LogOut, ChevronDown } from "lucide-react";

interface TopBarProps {
  userEmail: string;
  businessName: string;
}

export default function TopBar({ userEmail, businessName }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  return (
    <header className="h-14 bg-gunmetal border-b border-edge-steel flex items-center justify-between px-6">
      {/* Left spacer for mobile hamburger */}
      <div className="lg:hidden w-10" />

      {/* Business name */}
      <span className="text-sm font-medium text-white truncate">
        {businessName}
      </span>

      {/* Right side - user menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 text-sm text-concrete hover:text-white transition-colors"
        >
          <div className="w-7 h-7 bg-edge-steel rounded-full flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline max-w-[200px] truncate">
            {userEmail}
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-gunmetal border border-edge-steel rounded-lg shadow-xl py-1 z-50">
            <div className="px-4 py-2 border-b border-edge-steel">
              <p className="text-xs text-concrete">Signed in as</p>
              <p className="text-sm text-white truncate">{userEmail}</p>
              <p className="text-xs text-concrete mt-0.5 truncate">
                {businessName}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-concrete hover:text-critical hover:bg-critical/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
