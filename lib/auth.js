import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// Server-side Supabase client using Next.js cookie store.
// setAll is wrapped in try/catch because it may be called in read-only
// contexts (e.g. Server Components) where setting cookies is not allowed.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}

// Get the Supabase auth user, then fetch the matching driver record.
// auth_user_id links the auth.users table to our public.drivers table.
// Returns { user: null, driver: null } if not logged in.
export const getSessionAndDriver = cache(async function getSessionAndDriver() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, driver: null };

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, name, role, approved, email, auth_user_id")
    .eq("auth_user_id", user.id)
    .single();

  return { user, driver };
});

// Role check helpers — used in server components and pages to gate access.
// Prefer these over inline role string comparisons for consistency.
export function isAdmin(driver) {
  return driver?.role === "admin" || driver?.role === "super_admin";
}

export function isSuperAdmin(driver) {
  return driver?.role === "super_admin";
}

export function isExternal(driver) {
  return driver?.role === "external";
}

// Role check helper for race engineers.
// Engineers have full read access across all equipage tabs
// but can only interact with the Relais (stints) tab.
export function isEngineer(driver) {
  return driver?.role === "engineer";
}
