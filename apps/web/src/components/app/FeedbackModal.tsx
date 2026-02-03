"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle, Lightbulb, Bug, MessageCircle } from "lucide-react";

type FeedbackType = "enhancement" | "bug" | "general";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "enhancement",
    label: "Suggest an Enhancement",
    icon: <Lightbulb className="w-5 h-5" />,
    description: "Ideas for new features or improvements",
  },
  {
    value: "bug",
    label: "Report a Bug",
    icon: <Bug className="w-5 h-5" />,
    description: "Something isn't working correctly",
  },
  {
    value: "general",
    label: "General Feedback",
    icon: <MessageCircle className="w-5 h-5" />,
    description: "Questions, comments, or other feedback",
  },
];

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      setError("Please provide at least 10 characters of feedback.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: feedbackType,
          message: message.trim(),
          page_url: window.location.href,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSubmitted(true);
      setTimeout(() => {
        onClose();
        // Reset state after close animation
        setTimeout(() => {
          setSubmitted(false);
          setMessage("");
          setFeedbackType("general");
        }, 200);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (!submitting) {
      onClose();
      setTimeout(() => {
        setSubmitted(false);
        setMessage("");
        setFeedbackType("general");
        setError(null);
      }, 200);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gunmetal border border-edge-steel rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge-steel">
          <h2 className="text-lg font-semibold text-white">Provide Feedback</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-concrete hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          /* Success state */
          <div className="px-6 py-12 text-center">
            <CheckCircle className="w-12 h-12 text-safe mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Thank you!</h3>
            <p className="text-concrete text-sm">
              Your feedback has been submitted. We appreciate you taking the time to help us improve.
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Feedback type selector */}
            <div>
              <label className="block text-sm font-medium text-concrete mb-3">
                What type of feedback?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {FEEDBACK_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFeedbackType(type.value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                      feedbackType === type.value
                        ? "border-safety-orange bg-safety-orange/10 text-white"
                        : "border-edge-steel bg-asphalt/50 text-concrete hover:border-concrete/50 hover:text-white"
                    }`}
                  >
                    <div className={feedbackType === type.value ? "text-safety-orange" : ""}>
                      {type.icon}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs text-concrete">{type.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message textarea */}
            <div>
              <label className="block text-sm font-medium text-concrete mb-2">
                Your feedback
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  feedbackType === "enhancement"
                    ? "Describe the feature or improvement you'd like to see..."
                    : feedbackType === "bug"
                      ? "Describe what happened and what you expected to happen..."
                      : "Share your thoughts with us..."
                }
                rows={5}
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-4 py-3 text-white placeholder-concrete/50 focus:border-safety-orange focus:outline-none resize-none"
              />
              <p className="text-xs text-concrete/60 mt-1">
                {message.length}/5000 characters (minimum 10)
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-critical/10 border border-critical/20 rounded-lg px-4 py-3 text-sm text-critical">
                {error}
              </div>
            )}

            {/* Submit button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-concrete hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || message.trim().length < 10}
                className="flex items-center gap-2 px-5 py-2 bg-safety-orange text-white text-sm font-semibold rounded-lg hover:bg-safety-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

