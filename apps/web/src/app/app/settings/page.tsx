"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Building2,
  Save,
  AlertCircle,
  CheckCircle,
  LogOut,
  BookOpen,
  ArrowUpRight,
  Mail,
  Copy,
  RefreshCw,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  CreditCard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { BUSINESS_TYPES, CURRENCIES } from "@/lib/constants";
import type { IIInboundEmail } from "@/lib/ii-types";
import { ForwardingInstructions } from "@/components/app/ForwardingInstructions";

interface BusinessData {
  id: string;
  name: string;
  business_type: string | null;
  default_currency: string;
  timezone: string;
  plan_tier: string;
  ii_forwarding_email: string | null;
}

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("sole_proprietor");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Email alias state
  const [forwardingEmail, setForwardingEmail] = useState<string | null>(null);
  const [aliasLoading, setAliasLoading] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  // Inbound emails state
  const [inboundEmails, setInboundEmails] = useState<IIInboundEmail[]>([]);
  const [inboundTotal, setInboundTotal] = useState(0);
  const [inboundOffset, setInboundOffset] = useState(0);
  const [inboundLoadingMore, setInboundLoadingMore] = useState(false);
  const [showInboundEmails, setShowInboundEmails] = useState(false);

  // Forwarding instructions state
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setEmail(user.email ?? "");

      const { data: membership } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (membership) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("id, name, business_type, default_currency, timezone, plan_tier, ii_forwarding_email")
          .eq("id", membership.business_id)
          .single();

        if (biz) {
          setBusiness(biz);
          setName(biz.name);
          setBusinessType(biz.business_type ?? "sole_proprietor");
          setCurrency(biz.default_currency);
          setForwardingEmail(biz.ii_forwarding_email);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const INBOUND_PAGE_SIZE = 10;

  const loadInboundEmails = useCallback(
    async (offset = 0, append = false) => {
      if (!business) return;
      if (append) setInboundLoadingMore(true);
      const res = await fetch(
        `/api/inbound-emails?limit=${INBOUND_PAGE_SIZE}&offset=${offset}`
      );
      if (res.ok) {
        const data = await res.json();
        const fetched: IIInboundEmail[] = data.emails ?? [];
        setInboundEmails((prev) =>
          append ? [...prev, ...fetched] : fetched
        );
        setInboundTotal(data.total ?? 0);
        setInboundOffset(offset + fetched.length);
      }
      if (append) setInboundLoadingMore(false);
    },
    [business]
  );

  useEffect(() => {
    if (showInboundEmails && business) {
      loadInboundEmails();
    }
  }, [showInboundEmails, business, loadInboundEmails]);

  // Realtime subscription: live-update inbound email status changes
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    if (!showInboundEmails || !business) return;

    const supabase = createClient();
    const channel = supabase
      .channel("ii-inbound-emails-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ii_inbound_emails",
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          const updated = payload.new as IIInboundEmail;
          setInboundEmails((prev) =>
            prev.map((ie) => (ie.id === updated.id ? updated : ie))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ii_inbound_emails",
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          const inserted = payload.new as IIInboundEmail;
          setInboundEmails((prev) => [inserted, ...prev]);
          setInboundTotal((t) => t + 1);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [showInboundEmails, business]);

  async function handleGenerateAlias() {
    setAliasLoading(true);
    setAliasError(null);
    try {
      const res = await fetch("/api/email-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAliasError(data.error ?? "Failed to generate alias");
      } else {
        setForwardingEmail(data.forwarding_email);
      }
    } catch {
      setAliasError("Network error. Please try again.");
    }
    setAliasLoading(false);
  }

  async function handleRegenerateAlias() {
    setAliasLoading(true);
    setAliasError(null);
    setConfirmRegenerate(false);
    try {
      const res = await fetch("/api/email-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAliasError(data.error ?? "Failed to regenerate alias");
      } else {
        setForwardingEmail(data.forwarding_email);
      }
    } catch {
      setAliasError("Network error. Please try again.");
    }
    setAliasLoading(false);
  }

  async function handleCopyAlias() {
    if (!forwardingEmail) return;
    await navigator.clipboard.writeText(forwardingEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setError(null);
    setSuccess(false);
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("businesses")
      .update({
        name: name.trim(),
        business_type: businessType,
        default_currency: currency,
      })
      .eq("id", business.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin" />
      </div>
    );
  }

  const planLabel =
    {
      free: "Solo (Free)",
      starter: "Starter",
      pro: "Pro",
      enterprise: "Team",
    }[business?.plan_tier ?? "free"] ?? "Free";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* Account section */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-safety-orange" />
          <h2 className="text-lg font-semibold text-white">Account</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-concrete mb-1">Email</label>
            <p className="text-white text-sm">{email}</p>
          </div>
          <div>
            <label className="block text-sm text-concrete mb-1">Plan</label>
            <div className="flex items-center gap-3">
              <p className="text-white text-sm">{planLabel}</p>
              {(business?.plan_tier ?? "free") === "free" && (
                <Link
                  href="/app/settings/billing"
                  className="inline-flex items-center gap-1 text-xs text-safety-orange hover:underline"
                >
                  Upgrade
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Business section */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-safety-orange" />
          <h2 className="text-lg font-semibold text-white">Business</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-safe/10 border border-safe/20 rounded-lg p-3 text-sm text-safe">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Settings saved.
            </div>
          )}

          <div>
            <label
              htmlFor="bizName"
              className="block text-sm text-concrete mb-1.5"
            >
              Business Name
            </label>
            <input
              id="bizName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-asphalt border border-edge-steel rounded-lg px-4 py-2.5 text-white placeholder:text-concrete/50 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="bizType"
              className="block text-sm text-concrete mb-1.5"
            >
              Business Type
            </label>
            <select
              id="bizType"
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
              htmlFor="bizCurrency"
              className="block text-sm text-concrete mb-1.5"
            >
              Default Currency
            </label>
            <select
              id="bizCurrency"
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
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </form>
      </section>

      {/* Email Forwarding */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-5 h-5 text-safety-orange" />
          <h2 className="text-lg font-semibold text-white">
            Email Forwarding
          </h2>
        </div>

        <p className="text-concrete text-sm mb-4">
          Forward receipts from your email to Itemize-It for automatic
          processing. Each forwarded email with receipt attachments will be
          extracted and added to your receipt list.
        </p>

        {aliasError && (
          <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {aliasError}
          </div>
        )}

        {forwardingEmail ? (
          <div className="space-y-4">
            {/* Alias display */}
            <div>
              <label className="block text-sm text-concrete mb-1.5">
                Your forwarding address
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-asphalt border border-edge-steel rounded-lg px-4 py-2.5 text-white font-mono text-sm select-all">
                  {forwardingEmail}
                </div>
                <button
                  onClick={handleCopyAlias}
                  className="flex items-center gap-1.5 bg-asphalt border border-edge-steel hover:border-concrete/40 rounded-lg px-3 py-2.5 text-sm text-concrete hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-safe" />
                      <span className="text-safe">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Regenerate */}
            <div>
              {confirmRegenerate ? (
                <div className="flex items-center gap-3 bg-warn/10 border border-warn/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-warn shrink-0" />
                  <p className="text-sm text-warn flex-1">
                    This will generate a new address. The old one will stop
                    working. Continue?
                  </p>
                  <button
                    onClick={handleRegenerateAlias}
                    disabled={aliasLoading}
                    className="text-sm font-medium text-warn hover:text-white transition-colors"
                  >
                    Yes, regenerate
                  </button>
                  <button
                    onClick={() => setConfirmRegenerate(false)}
                    className="text-sm text-concrete hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRegenerate(true)}
                  disabled={aliasLoading}
                  className="flex items-center gap-1.5 text-sm text-concrete hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate address
                </button>
              )}
            </div>

            {/* Recent inbound emails */}
            <div>
              <button
                onClick={() => setShowInboundEmails(!showInboundEmails)}
                className="flex items-center gap-1.5 text-sm text-concrete hover:text-white transition-colors"
              >
                {showInboundEmails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                Recent forwarded emails
              </button>

              {showInboundEmails && (
                <div className="mt-3 space-y-2">
                  {inboundEmails.length === 0 ? (
                    <p className="text-sm text-concrete/60 italic">
                      No emails received yet. Forward a receipt to get started.
                    </p>
                  ) : (
                    <>
                      {inboundEmails.map((ie) => (
                        <div
                          key={ie.id}
                          className="flex items-center gap-3 bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-sm"
                        >
                          <InboundEmailStatusIcon status={ie.status} />
                          <div className="flex-1 min-w-0">
                            <p className="text-white truncate">
                              {ie.subject ?? ie.from_email}
                            </p>
                            <p className="text-concrete text-xs">
                              {ie.from_email} &middot;{" "}
                              {new Date(ie.received_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          </div>
                          <div className="text-xs text-concrete shrink-0">
                            {ie.status === "processed" && (
                              <span className="text-safe">
                                {ie.receipts_created} receipt
                                {ie.receipts_created !== 1 ? "s" : ""}
                              </span>
                            )}
                            {ie.status === "partial" && (
                              <span
                                className="text-warn"
                                title={ie.error_message ?? "Some attachments failed"}
                              >
                                {ie.receipts_created} of {ie.attachment_count} processed
                              </span>
                            )}
                            {ie.status === "failed" && (
                              <span
                                className="text-critical"
                                title={ie.error_message ?? "Unknown error"}
                              >
                                Failed
                              </span>
                            )}
                            {ie.status === "pending" && (
                              <span className="text-concrete">Queued</span>
                            )}
                            {ie.status === "processing" && (
                              <span className="text-warn">Processing</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {inboundOffset < inboundTotal && (
                        <button
                          onClick={() =>
                            loadInboundEmails(inboundOffset, true)
                          }
                          disabled={inboundLoadingMore}
                          className="flex items-center justify-center gap-1.5 w-full text-sm text-concrete hover:text-white py-2 transition-colors disabled:opacity-50"
                        >
                          {inboundLoadingMore ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Loading…
                            </>
                          ) : (
                            <>
                              Load more ({inboundTotal - inboundOffset}{" "}
                              remaining)
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Forwarding instructions toggle */}
            <div>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex items-center gap-1.5 text-sm text-safety-orange hover:underline"
              >
                <Info className="w-3.5 h-3.5" />
                How to set up email forwarding
              </button>

              {showInstructions && <ForwardingInstructions email={forwardingEmail} />}
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerateAlias}
            disabled={aliasLoading}
            className="flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
          >
            {aliasLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Generate Forwarding Address
          </button>
        )}
      </section>

      {/* Classification Rules */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-5 h-5 text-safety-orange" />
          <h2 className="text-lg font-semibold text-white">
            Classification Rules
          </h2>
        </div>
        <p className="text-concrete text-sm mb-3">
          Set up rules to automatically classify expenses by merchant or
          keyword.
        </p>
        <Link
          href="/app/settings/rules"
          className="inline-flex items-center gap-1.5 text-sm text-safety-orange hover:underline"
        >
          Manage rules
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* Billing */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="w-5 h-5 text-safety-orange" />
          <h2 className="text-lg font-semibold text-white">
            Billing & Plans
          </h2>
        </div>
        <p className="text-concrete text-sm mb-3">
          Manage your subscription, view usage, and upgrade your plan.
        </p>
        <Link
          href="/app/settings/billing"
          className="inline-flex items-center gap-1.5 text-sm text-safety-orange hover:underline"
        >
          Manage billing
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* Team */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-5 h-5 text-safety-orange" />
          <h2 className="text-lg font-semibold text-white">Team</h2>
        </div>
        <p className="text-concrete text-sm mb-3">
          Invite team members, manage roles, and collaborate on expenses.
        </p>
        <Link
          href="/app/settings/team"
          className="inline-flex items-center gap-1.5 text-sm text-safety-orange hover:underline"
        >
          Manage team
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* Sign out */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-concrete hover:text-critical transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out of Itemize-It
        </button>
      </section>
    </div>
  );
}

function InboundEmailStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "processed":
      return <CheckCircle className="w-4 h-4 text-safe shrink-0" />;
    case "partial":
      return <AlertCircle className="w-4 h-4 text-warn shrink-0" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-critical shrink-0" />;
    case "processing":
      return <Loader2 className="w-4 h-4 text-warn shrink-0 animate-spin" />;
    case "pending":
    default:
      return <Clock className="w-4 h-4 text-concrete shrink-0" />;
  }
}

