"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "../lib/supabase-browser";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/pilotes", label: "Pilotes" },
  { href: "/evenements", label: "Événements" },
  { href: "/inventaire", label: "Inventaire" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState("dark");
  const [driver, setDriver] = useState(null);

  const [pendingCount, setPendingCount] = useState(0);

  // Realtime keeps the badge live during the session without polling.
  // The separate pathname effect re-fetches on navigation as a safety net
  // in case the Realtime event is missed.
  useEffect(() => {
    if (!driver?.id) return;
    if (driver.role !== "admin" && driver.role !== "super_admin") return;

    const fetchCount = () =>
      supabase
        .from("drivers")
        .select("*", { count: "exact", head: true })
        .eq("approved", false)
        .eq("refused", false)
        .then(({ count }) => setPendingCount(count || 0));

    const channel = supabase
      .channel("drivers-pending")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => fetchCount(),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [driver?.id]);

  // Re-fetch on navigation
  useEffect(() => {
    if (!driver?.id) return;
    if (driver.role !== "admin" && driver.role !== "super_admin") return;
    supabase
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("approved", false)
      .eq("refused", false)
      .then(({ count }) => setPendingCount(count || 0));
  }, [pathname, driver?.id]);

  // Read theme from localStorage in useEffect, not useState initializer —
  // localStorage is not available during SSR, reading it directly causes hydration mismatch.
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("drivers")
        .select("id, name, role")
        .eq("auth_user_id", user.id)
        .single();
      if (data) setDriver(data);
    });
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const isAdmin = driver?.role === "admin" || driver?.role === "super_admin";

  const isEngineer = driver?.role === "engineer";

  const logoSrc =
    theme === "dark" ? "/kronos-logo-text.png" : "/kronos-logo-light.png";

  return (
    <nav
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          minHeight: "56px",
          flexWrap: "wrap",
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <img
            src={logoSrc}
            alt="Kronos SimSports"
            style={{ height: "34px", objectFit: "contain", display: "block" }}
          />
        </Link>

        {/* Nav links — between logo and controls so desktop order is correct.
          On mobile, width:100% from .nav-links forces this to its own row below. */}
        {driver && (
          <div
            className="nav-links"
            style={{
              display: "flex",
              gap: "0.25rem",
              // flex:1 is in globals.css .nav-links — can't use inline or it overrides the mobile media query
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {links
              .filter((l) => {
                // Hide Admin for non-admins
                if (l.href === "/admin" && !isAdmin) return false;
                // Hide Inventaire for external drivers
                if (l.href === "/inventaire" && driver.role === "external")
                  return false;
                return true;
              })
              .map(({ href, label }) => {
                const active =
                  pathname === href ||
                  (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      textDecoration: "none",
                      padding: "0.4rem 0.85rem",
                      borderRadius: "3px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                      background: active ? "var(--surface-2)" : "transparent",
                      borderBottom: active
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                      transition: "color 0.15s",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                    {href === "/admin" && pendingCount > 0 && (
                      <span
                        style={{
                          marginLeft: "0.4rem",
                          background: "var(--danger)",
                          color: "#fff",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "10px",
                          verticalAlign: "middle",
                        }}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        )}

        {/* Right side — marginLeft:auto keeps it pinned right when links don't fill the row */}
        <div
          className="nav-controls"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexShrink: 0,
            marginLeft: "auto",
          }}
        >
          {driver && (
            <Link
              href={`/pilotes/${driver.id}`}
              className="nav-driver-name"
              style={{
                textDecoration: "none",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--text-dim)",
                whiteSpace: "nowrap",
              }}
            >
              {driver.name}
              {driver.role !== "driver" && driver.role !== "external" && (
                <span
                  style={{
                    marginLeft: "0.4rem",
                    fontSize: "0.65rem",
                    // Engineers get amber, admins get the standard accent colour
                    color: isEngineer ? "#f59e0b" : "var(--accent)",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {driver.role === "super_admin"
                    ? "Super Admin"
                    : driver.role === "engineer"
                      ? "Ingénieur"
                      : "Admin"}
                </span>
              )}
            </Link>
          )}

          <button
            onClick={toggleTheme}
            className="theme-toggle"
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {driver && (
            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
              Déconnexion
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
