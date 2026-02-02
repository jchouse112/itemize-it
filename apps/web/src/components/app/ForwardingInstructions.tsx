"use client";

/**
 * Step-by-step instructions for setting up email forwarding to Itemize-It.
 * Extracted from the Settings page for maintainability.
 */
export function ForwardingInstructions({ email }: { email: string }) {
  return (
    <div className="mt-3 bg-asphalt border border-edge-steel rounded-lg p-4 space-y-4 text-sm">
      <div>
        <h4 className="text-white font-medium mb-2">Gmail</h4>
        <ol className="text-concrete space-y-1 list-decimal list-inside">
          <li>Open Gmail and go to Settings (gear icon)</li>
          <li>Click &ldquo;See all settings&rdquo; &rarr; &ldquo;Forwarding and POP/IMAP&rdquo;</li>
          <li>Click &ldquo;Add a forwarding address&rdquo;</li>
          <li>
            Enter <span className="text-white font-mono">{email}</span>
          </li>
          <li>Verify the address, then create a filter to forward receipt emails</li>
        </ol>
      </div>

      <div>
        <h4 className="text-white font-medium mb-2">Outlook / Microsoft 365</h4>
        <ol className="text-concrete space-y-1 list-decimal list-inside">
          <li>Go to Settings &rarr; Mail &rarr; Rules</li>
          <li>Create a new rule for incoming emails</li>
          <li>Set condition (e.g., from specific merchants or with &ldquo;receipt&rdquo; in subject)</li>
          <li>
            Set action to &ldquo;Forward to&rdquo;{" "}
            <span className="text-white font-mono">{email}</span>
          </li>
        </ol>
      </div>

      <div>
        <h4 className="text-white font-medium mb-2">Apple Mail</h4>
        <ol className="text-concrete space-y-1 list-decimal list-inside">
          <li>Open Mail &rarr; Settings &rarr; Rules</li>
          <li>Click &ldquo;Add Rule&rdquo;</li>
          <li>Set condition (e.g., &ldquo;From&rdquo; contains a merchant name)</li>
          <li>
            Set action to &ldquo;Forward Message&rdquo; to{" "}
            <span className="text-white font-mono">{email}</span>
          </li>
        </ol>
      </div>

      <div>
        <h4 className="text-white font-medium mb-2">Manual Forwarding</h4>
        <p className="text-concrete">
          You can also forward individual receipt emails directly to{" "}
          <span className="text-white font-mono">{email}</span>. Attachments
          (images and PDFs) will be automatically extracted and processed.
        </p>
      </div>

      <div className="border-t border-edge-steel pt-3">
        <h4 className="text-white font-medium mb-1">Tips</h4>
        <ul className="text-concrete space-y-1 list-disc list-inside">
          <li>Receipt images (JPG, PNG, HEIC) and PDFs are supported</li>
          <li>Multiple attachments per email are processed individually</li>
          <li>Emails without valid receipt attachments will be marked as failed</li>
          <li>Processing usually completes within a few seconds</li>
        </ul>
      </div>
    </div>
  );
}
