import { createClient } from "@supabase/supabase-js";

/**
 * Server-side only Supabase admin client.
 * Uses SERVICE_ROLE key — NEVER expose this to the browser.
 * Only import this file inside API routes (app/api/**).
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
