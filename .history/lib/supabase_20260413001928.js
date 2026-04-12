import { createClient } from "@supabase/supabase-js";
// Legacy anon client — prefer createBrowserClient from @supabase/ssr in client components
// and supabaseServer in server components. This file kept for backwards compatibility.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
