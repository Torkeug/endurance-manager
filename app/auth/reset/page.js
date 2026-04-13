"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";

export default function AuthReset() {
  const router = useRouter();

  // Client-side PKCE password reset handler.
  // Reset emails link to /auth/reset#token_hash=...&type=recovery (hash, not query params).
  // We parse the hash here and call verifyOtp to establish a session before redirecting.
  // This must be client-side — hash fragments are not sent to the server.
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token_hash = params.get("token_hash");
    const type = params.get("type");

    if (token_hash && type === "recovery") {
      supabase.auth
        .verifyOtp({ token_hash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            router.push("/login?error=link_expired");
          } else {
            router.push("/update-password");
          }
        });
    } else {
      router.push("/login?error=auth");
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ color: "var(--text-dim)" }}>Vérification en cours…</p>
    </div>
  );
}
