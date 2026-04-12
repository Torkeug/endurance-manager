import { createBrowserClient } from "@supabase/ssr";

// Browser client singleton with implicit flow — used for auth callbacks.
// flowType: 'implicit' is required for the password reset PKCE handler in /auth/reset.
export function createBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: "implicit",
      },
    },
  );
}

export const supabaseBrowser = createBrowser();
