"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Mail,
  Shield,
  Crown,
  Eye,
  UserMinus,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Send,
} from "lucide-react";
import Link from "next/link";
import type { PlanTier, MemberRole } from "@/lib/ii-types";

interface Member {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  status: string;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  email?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface TeamResponse {
  members: Member[];
  invitations: Invitation[];
  callerUserId: string;
  callerRole: MemberRole | null;
  planTier: PlanTier;
  seatsLimit: number;
}

const ROLE_ICONS: Record<MemberRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Eye,
};

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const INVITE_ROLES: { value: string; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Current user info — populated from the API response
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<MemberRole | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [seatsLimit, setSeatsLimit] = useState(1);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  // Action states
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("Failed to load team");
      const data: TeamResponse = await res.json();
      setMembers(data.members ?? []);
      setInvitations(data.invitations ?? []);
      setCurrentUserId(data.callerUserId);
      setCurrentRole(data.callerRole);
      setPlanTier(data.planTier);
      setSeatsLimit(data.seatsLimit);
    } catch {
      setError("Failed to load team data");
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadTeam();
      setLoading(false);
    }
    init();
  }, [loadTeam]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to send invitation");
        if (data.upgrade) {
          setError(data.error + " Upgrade on the Billing page.");
        }
      } else {
        setSuccess(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        await loadTeam();
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setInviting(false);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleUpdateRole(memberId: string, newRole: string) {
    setUpdatingId(memberId);
    setError(null);

    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to update role");
      } else {
        await loadTeam();
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setUpdatingId(null);
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    setError(null);

    try {
      const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to remove member");
      } else {
        setConfirmRemoveId(null);
        await loadTeam();
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setRemovingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin" />
      </div>
    );
  }

  const isAdminOrOwner = currentRole === "owner" || currentRole === "admin";
  const activeMembers = members.filter((m) => m.status === "active");

  // If single-seat plan, show upgrade prompt
  if (seatsLimit <= 1 && planTier !== "enterprise" && planTier !== "pro") {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/app/settings"
            className="text-concrete hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Team</h1>
        </div>

        <section className="bg-gunmetal border border-edge-steel rounded-xl p-6">
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-concrete/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Team features require a Pro or Team plan
            </h2>
            <p className="text-concrete text-sm mb-6 max-w-md mx-auto">
              Upgrade your plan to invite team members, assign roles, and
              collaborate on expense management.
            </p>
            <Link
              href="/app/settings/billing"
              className="inline-flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
            >
              View Plans
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/app/settings"
          className="text-concrete hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Team</h1>
        <span className="ml-auto text-sm text-concrete">
          {activeMembers.length} / {seatsLimit} seats
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-safe/10 border border-safe/20 rounded-lg p-3 text-sm text-safe mb-4">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Invite Form */}
      {isAdminOrOwner && (
        <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Send className="w-5 h-5 text-safety-orange" />
            <h2 className="text-lg font-semibold text-white">
              Invite Team Member
            </h2>
          </div>

          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="flex-1 bg-asphalt border border-edge-steel rounded-lg px-4 py-2.5 text-white placeholder:text-concrete/50 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange transition-colors text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-asphalt border border-edge-steel rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
            >
              {INVITE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Invite
            </button>
          </form>
        </section>
      )}

      {/* Members List */}
      <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-safety-orange" />
          <h2 className="text-lg font-semibold text-white">Members</h2>
        </div>

        <div className="space-y-3">
          {members.map((member) => {
            const RoleIcon = ROLE_ICONS[member.role] ?? Users;
            const isCurrentUser = member.user_id === currentUserId;
            const canModify =
              isAdminOrOwner && !isCurrentUser && member.role !== "owner";

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-asphalt border border-edge-steel rounded-lg px-4 py-3"
              >
                <RoleIcon className="w-4 h-4 text-concrete shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">
                    {member.email ?? member.user_id}
                    {isCurrentUser && (
                      <span className="text-concrete ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-concrete text-xs">
                    {ROLE_LABELS[member.role]}
                    {member.joined_at && (
                      <>
                        {" "}
                        &middot; Joined{" "}
                        {new Date(member.joined_at).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>

                {canModify && (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleUpdateRole(member.id, e.target.value)
                      }
                      disabled={updatingId === member.id}
                      className="bg-gunmetal border border-edge-steel rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-safety-orange/50"
                    >
                      {INVITE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>

                    {confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRemove(member.id)}
                          disabled={removingId === member.id}
                          className="text-xs text-critical hover:underline"
                        >
                          {removingId === member.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs text-concrete hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="text-concrete hover:text-critical transition-colors"
                        title="Remove member"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <section className="bg-gunmetal border border-edge-steel rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-safety-orange" />
            <h2 className="text-lg font-semibold text-white">
              Pending Invitations
            </h2>
          </div>

          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 bg-asphalt border border-edge-steel rounded-lg px-4 py-2.5"
              >
                <Mail className="w-4 h-4 text-concrete shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{inv.email}</p>
                  <p className="text-concrete text-xs">
                    {inv.role} &middot; Expires{" "}
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-warn">Pending</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
