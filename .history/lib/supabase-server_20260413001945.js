import { createClient } from "@supabase/supabase-js";
// Service role client for server components only — bypasses RLS.
// NEVER import this in client components or expose the service role key to the browser.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
