"use client";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export default function PendingPage() {
  const router = useRouter();
  const t = useTranslations("pending");

  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: driver } = await supabase
        .from("drivers")
        .select("approved")
        .eq("auth_user_id", user.id)
        .single();
      if (driver?.approved) {
        router.push("/");
        router.refresh();
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src={theme === "dark" ? "/kronos-logo-text.png" : "/kronos-logo-light.png"}
            alt="Kronos SimSports"
            style={{ height: "56px", objectFit: "contain", display: "block", margin: "0 auto" }}
          />
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
          <h2 style={{ marginBottom: "0.75rem" }}>{t("title")}</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>
            {t("body1")}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>
            {t("body2")}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            {t("body3")}
          </p>
          <button onClick={handleLogout} className="btn btn-secondary">
            {t("logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
