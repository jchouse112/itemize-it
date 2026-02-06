// Legacy Supabase Edge Function: process-receipt
// SECURITY: Disabled by default because the web app now uses
// /api/internal/process-receipt with INTERNAL_API_SECRET auth.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
} as const;

serve(async () => {
  return new Response(
    JSON.stringify({
      error:
        "This legacy edge function is disabled. Use /api/internal/process-receipt instead.",
    }),
    {
      status: 410,
      headers: JSON_HEADERS,
    }
  );
});
