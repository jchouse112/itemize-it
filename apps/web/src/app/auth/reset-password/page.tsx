"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-asphalt flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-8">
            <div className="w-12 h-12 bg-safe/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-safe" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Password updated
            </h2>
            <p className="text-concrete text-sm mb-6">
              Your password has been changed successfully. You can now sign in
              with your new password.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
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
          <p className="mt-3 text-concrete text-sm">Set a new password</p>
        </div>

        {/* Form card */}
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-safety-orange/10 rounded-lg flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-safety-orange" />
            </div>
            <div>
              <h2 className="text-white font-semibold">New password</h2>
              <p className="text-xs text-concrete">
                Choose a strong password with at least 8 characters.
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
                htmlFor="password"
                className="block text-sm font-medium text-concrete mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-concrete" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                  className="w-full bg-asphalt border border-edge-steel rounded-lg pl-10 pr-10 py-2.5 text-white placeholder:text-concrete/50 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-concrete hover:text-white transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-concrete mb-1.5"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-concrete" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat your password"
                  className="w-full bg-asphalt border border-edge-steel rounded-lg pl-10 pr-10 py-2.5 text-white placeholder:text-concrete/50 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-concrete hover:text-white transition-colors"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
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
                "Update Password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
