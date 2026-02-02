"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-asphalt flex items-center justify-center p-4">
          <Loader2 className="w-10 h-10 text-safety-orange animate-spin" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenRef = useRef(searchParams?.get("token") ?? null);
  const token = tokenRef.current;

  // Strip token from URL to prevent leaking via Referer headers / browser history
  useEffect(() => {
    if (token && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [token]);

  const [status, setStatus] = useState<
    "loading" | "accepting" | "success" | "error" | "login_required"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No invitation token provided");
      return;
    }

    async function accept() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in — redirect to login with return URL
        setStatus("login_required");
        return;
      }

      setStatus("accepting");

      try {
        const res = await fetch("/api/team/invite/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.error ?? "Failed to accept invitation");
          return;
        }

        setStatus("success");
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          router.push("/app/dashboard");
        }, 2000);
      } catch {
        setStatus("error");
        setErrorMessage("Network error. Please try again.");
      }
    }

    accept();
  }, [token, router]);

  const loginUrl = `/auth/login?redirect=${encodeURIComponent(`/auth/accept-invite?token=${token}`)}`;

  return (
    <div className="min-h-screen bg-asphalt flex items-center justify-center p-4">
      <div className="bg-gunmetal border border-edge-steel rounded-xl p-8 max-w-md w-full text-center">
        {status === "loading" || status === "accepting" ? (
          <>
            <Loader2 className="w-10 h-10 text-safety-orange mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold text-white mb-2">
              Accepting Invitation
            </h1>
            <p className="text-concrete text-sm">
              Please wait while we process your invitation...
            </p>
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle className="w-10 h-10 text-safe mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">
              Welcome to the team!
            </h1>
            <p className="text-concrete text-sm mb-4">
              Your invitation has been accepted. Redirecting to dashboard...
            </p>
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-2 text-sm text-safety-orange hover:underline"
            >
              Go to Dashboard
            </Link>
          </>
        ) : status === "login_required" ? (
          <>
            <Users className="w-10 h-10 text-safety-orange mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">
              Sign in to accept invitation
            </h1>
            <p className="text-concrete text-sm mb-6">
              You need to sign in or create an account to accept this team
              invitation.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href={loginUrl}
                className="flex items-center justify-center gap-2 bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href={`/auth/signup?redirect=${encodeURIComponent(`/auth/accept-invite?token=${token}`)}`}
                className="flex items-center justify-center gap-2 bg-asphalt border border-edge-steel hover:border-concrete/40 text-white rounded-lg px-5 py-2.5 text-sm transition-colors"
              >
                Create Account
              </Link>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-10 h-10 text-critical mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">
              Unable to Accept Invitation
            </h1>
            <p className="text-concrete text-sm mb-4">
              {errorMessage ?? "Something went wrong."}
            </p>
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-2 text-sm text-safety-orange hover:underline"
            >
              Go to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
