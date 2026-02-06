"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Building2, ArrowRight, AlertCircle } from "lucide-react";
import { BUSINESS_TYPES, CURRENCIES } from "@/lib/constants";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("sole_proprietor");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    // Prefer the current membership-selected business. If none exists, create
    // a new business (which auto-creates owner membership via DB trigger).
    const { data: existingBusinessId } = await supabase.rpc(
      "get_user_business_id"
    );

    if (existingBusinessId) {
      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          name: name.trim(),
          business_type: businessType,
          default_currency: currency,
        })
        .eq("id", existingBusinessId);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("businesses").insert({
        owner_id: user.id,
        name: name.trim(),
        business_type: businessType,
        default_currency: currency,
      });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
      // The on_business_created DB trigger auto-creates the business_members row.
    }

    window.location.href = "/app/dashboard";
  }

  return (
    <div className="min-h-screen bg-asphalt flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-safety-orange/10 border border-safety-orange/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-safety-orange" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Set up your business
          </h1>
          <p className="mt-2 text-concrete text-sm">
            This helps us organize your expenses. You can change these later.
          </p>
        </div>

        <div className="bg-gunmetal border border-edge-steel rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-concrete mb-1.5"
              >
                Business Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Acme Contracting"
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-4 py-2.5 text-white placeholder:text-concrete/50 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-concrete mb-1.5"
              >
                Business Type
              </label>
              <select
                id="type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors"
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="currency"
                className="block text-sm font-medium text-concrete mb-1.5"
              >
                Default Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full flex items-center justify-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
