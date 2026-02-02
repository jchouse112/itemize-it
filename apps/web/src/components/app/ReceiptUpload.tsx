"use client";

import { useState, useRef } from "react";
import { Upload, X, FileImage, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";

interface DuplicateInfo {
  id: string;
  merchant: string | null;
  created_at: string;
  status: string;
}

interface ReceiptUploadProps {
  onUploadComplete: () => void;
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

type UploadPhase = "idle" | "uploading" | "extracting";

const PHASE_LABELS: Record<Exclude<UploadPhase, "idle">, { text: string; sub: string }> = {
  uploading: { text: "Uploading...", sub: "Sending file to storage" },
  extracting: { text: "Extracting receipt data...", sub: "We're reading your receipt" },
};

export default function ReceiptUpload({ onUploadComplete }: ReceiptUploadProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";

  async function uploadFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Unsupported file type. Use JPG, PNG, PDF, or HEIC.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
      return;
    }

    setError(null);
    setDuplicate(null);
    setPhase("uploading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Transition to extracting after a short delay — the API call
      // handles both upload + extraction in one request, so we show
      // "Extracting..." after ~2s to reflect the actual work being done.
      const extractionTimer = setTimeout(() => setPhase("extracting"), 2000);

      const res = await fetch("/api/receipts", {
        method: "POST",
        body: formData,
      });

      clearTimeout(extractionTimer);

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.duplicate_of) {
          setDuplicate(data.duplicate_of);
          setError(data.error || "Duplicate detected.");
          return;
        }
        throw new Error(data.error || "Upload failed");
      }

      setOpen(false);
      setDuplicate(null);
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPhase("idle");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Upload Receipt
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gunmetal border border-edge-steel rounded-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Upload Receipt</h2>
          <button
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="text-concrete hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
            {duplicate && (
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href={`/app/receipts/${duplicate.id}`}
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                    setDuplicate(null);
                  }}
                  className="flex items-center gap-1 text-xs text-safety-orange hover:text-safety-orange/80 font-medium"
                >
                  View existing receipt
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <span className="text-xs text-concrete/40">
                  {duplicate.merchant ?? "Unknown"} &middot; {duplicate.status}
                </span>
              </div>
            )}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
            ${
              dragOver
                ? "border-safety-orange bg-safety-orange/5"
                : "border-edge-steel hover:border-concrete"
            }
            ${busy ? "pointer-events-none opacity-50" : ""}
          `}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin" />
              <p className="text-sm text-white font-medium">
                {PHASE_LABELS[phase as Exclude<UploadPhase, "idle">]?.text}
              </p>
              <p className="text-xs text-concrete">
                {PHASE_LABELS[phase as Exclude<UploadPhase, "idle">]?.sub}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <FileImage className="w-10 h-10 text-concrete/40" />
              <div>
                <p className="text-sm text-white font-medium">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-concrete mt-1">
                  JPG, PNG, PDF, HEIC — up to {MAX_FILE_SIZE_BYTES / 1024 / 1024} MB
                </p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
