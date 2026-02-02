"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Mail,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  KeyRound,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-asphalt flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-8">
            <div className="w-12 h-12 bg-safe/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-safe" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Check your email
            </h2>
            <p className="text-concrete text-sm mb-6">
              We sent a password reset link to{" "}
              <span className="text-white font-medium">{email}</span>. Click the
              link to set a new password.
            </p>
            <Link
              href="/auth/login"
              className="text-safety-orange hover:underline text-sm inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-asphalt flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-safety-orange rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">II</span>
            </div>
            <span className="text-xl font-bold text-white">Itemize-It</span>
          </Link>
          <p className="mt-3 text-concrete text-sm">Reset your password</p>
        </div>

        {/* Form card */}
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-safety-orange/10 rounded-lg flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-safety-orange" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Forgot password?</h2>
              <p className="text-xs text-concrete">
                Enter your email and we&apos;ll send a reset link.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-concrete mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-concrete" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-asphalt border border-edge-steel rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-concrete/50 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-edge-steel text-center text-sm text-concrete">
            <Link
              href="/auth/login"
              className="text-safety-orange hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
