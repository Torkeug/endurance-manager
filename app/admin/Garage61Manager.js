"use client";
import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

const CACHE_KEY = "garage61_detected_drivers";
const DETECTION_DRIVER_KEY = "garage61_detection_driver_id";

// Normalize a name for comparison: lowercase, trim, strip accents, collapse spaces.
const normalize = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

// Returns true if one first name is a prefix of the other (min 3 chars).
// Catches nicknames like "Flo" → "Florian", "Alex" → "Alexandre".
function firstNamePrefixMatch(nameA, nameB) {
  const tokA = nameA.split(" ");
  const tokB = nameB.split(" ");
  const firstA = tokA[0];
  const firstB = tokB[0];
  const lastA = tokA.slice(1).join(" ");
  const lastB = tokB.slice(1).join(" ");
  if (lastA !== lastB || !lastA) return false;
  const minLen = Math.min(firstA.length, firstB.length);
  if (minLen < 3) return false;
  return firstA.startsWith(firstB) || firstB.startsWith(firstA);
}

// Match Garage61 drivers to DB drivers and classify each pair.
// Statuses:
//   confirmed  — DB driver already has this exact slug
//   exact      — names match exactly, slug not yet set → safe to auto-apply
//   fuzzy      — first name is a prefix of the other (e.g. Flo/Florian), same last name
//   conflict   — names match but DB already has a DIFFERENT slug
//   ambiguous  — multiple DB drivers share the same normalized name
//   no_match   — no DB driver found with a matching name
function buildMatches(g61Drivers, dbDrivers) {
  const dbByNorm = new Map();
  for (const d of dbDrivers) {
    const key = normalize(d.name);
    if (!dbByNorm.has(key)) dbByNorm.set(key, []);
    dbByNorm.get(key).push(d);
  }

  return g61Drivers.map((g61) => {
    const normG61 = normalize(g61.name);
    const candidates = dbByNorm.get(normG61) || [];

    if (candidates.length === 0) {
      // Second pass: fuzzy first-name prefix match (e.g. "Flo" → "Florian")
      const fuzzyMatches = dbDrivers.filter(
        (d) => firstNamePrefixMatch(normG61, normalize(d.name))
      );
      if (fuzzyMatches.length === 1) {
        const dbDriver = fuzzyMatches[0];
        if (dbDriver.garage61_slug === g61.slug) return { g61, status: "confirmed", dbDriver };
        if (dbDriver.garage61_slug) return { g61, status: "conflict", dbDriver };
        return { g61, status: "fuzzy", dbDriver };
      }
      return { g61, status: "no_match", dbDriver: null };
    }

    if (candidates.length > 1) return { g61, status: "ambiguous", dbDriver: null, candidates };
    const dbDriver = candidates[0];
    if (dbDriver.garage61_slug === g61.slug) return { g61, status: "confirmed", dbDriver };
    if (dbDriver.garage61_slug) return { g61, status: "conflict", dbDriver };
    return { g61, status: "exact", dbDriver };
  });
}

const STATUS_META = {
  confirmed: { label: "✓ Lié",                   color: "#2eb460" },
  exact:     { label: "→ Correspondance exacte",  color: "var(--accent)" },
  fuzzy:     { label: "~ Correspondance partielle", color: "#7eb8e0" },
  conflict:  { label: "⚠ Conflit",               color: "#e07b39" },
  ambiguous: { label: "⚠ Ambigu",                color: "#c9a84c" },
  no_match:  { label: "Inconnu",                  color: "var(--text-dim)" },
};

const thStyle = {
  background: "var(--surface-2)",
  color: "var(--text-dim)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "0.6rem 1rem",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle = { padding: "0.55rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" };

export default function Garage61Manager({ currentDriver }) {
  const locale = useLocale();
  const [dbDrivers, setDbDrivers] = useState([]);
  const [g61Drivers, setG61Drivers] = useState(null); // null = not yet loaded
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedCount, setSavedCount] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [linkedDrivers, setLinkedDrivers] = useState([]);
  const [detectionDriverId, setDetectionDriverId] = useState("");

  // On mount: load DB drivers + cached detection result from settings table
  useEffect(() => {
    supabase
      .from("drivers")
      .select("id, name, garage61_slug")
      .eq("approved", true)
      .neq("role", "engineer")
      .eq("is_test_account", false)
      .order("name")
      .then(({ data }) => setDbDrivers(data || []));

    Promise.all([
      supabase.from("settings").select("value").eq("key", CACHE_KEY).maybeSingle(),
      supabase.from("settings").select("value").eq("key", DETECTION_DRIVER_KEY).maybeSingle(),
      supabase.from("drivers").select("id, name").not("garage61_access_token", "is", null).neq("role", "engineer").eq("is_test_account", false).order("name"),
    ]).then(([{ data: cacheRow }, { data: driverIdRow }, { data: linked }]) => {
      if (cacheRow?.value) {
        try {
          const cached = JSON.parse(cacheRow.value);
          setG61Drivers(cached.drivers || []);
          setLastUpdated(cached.updated_at || null);
        } catch { /* ignore */ }
      }
      setDetectionDriverId(driverIdRow?.value || "");
      setLinkedDrivers(linked || []);
    });
  }, []);

  const saveDetectionDriver = async (id) => {
    setDetectionDriverId(id);
    await supabase.from("settings").upsert(
      { key: DETECTION_DRIVER_KEY, value: id },
      { onConflict: "key" },
    );
  };

  const runDetect = async () => {
    setLoading(true);
    setError(null);
    setSavedCount(null);
    try {
      const res = await fetch("/api/admin/garage61-detect");
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "not_linked"
            ? "Votre compte Garage61 n'est pas lié. Connectez-le sur votre profil pilote."
            : data.error === "token_expired"
              ? "Session Garage61 expirée — re-liez votre compte."
              : `Erreur : ${data.error ?? "inconnue"}`,
        );
      } else {
        const drivers = data.drivers || [];
        const updated_at = new Date().toISOString();
        setG61Drivers(drivers);
        setLastUpdated(updated_at);
        // Persist to settings so any admin sees the latest detection immediately
        await supabase.from("settings").upsert(
          { key: CACHE_KEY, value: JSON.stringify({ drivers, updated_at }) },
          { onConflict: "key" },
        );
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const applyExact = async (matches) => {
    const toApply = matches.filter((m) => m.status === "exact" && m.dbDriver);
    if (toApply.length === 0) return;
    setSaving(true);
    await Promise.all(
      toApply.map((m) =>
        supabase.from("drivers").update({ garage61_slug: m.g61.slug }).eq("id", m.dbDriver.id)
      )
    );
    const { data } = await supabase.from("drivers").select("id, name, garage61_slug").eq("approved", true).order("name");
    setDbDrivers(data || []);
    setSavedCount(toApply.length);
    setSaving(false);
  };

  const applyOverride = async (dbDriverId, slug) => {
    await supabase.from("drivers").update({ garage61_slug: slug }).eq("id", dbDriverId);
    const { data } = await supabase.from("drivers").select("id, name, garage61_slug").eq("approved", true).order("name");
    setDbDrivers(data || []);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[dbDriverId];
      return next;
    });
  };

  if (g61Drivers === null) {
    return (
      <div>
        {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}
        <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
          Aucune détection enregistrée. Lancez une détection pour lier les pilotes Garage61.
        </p>
        <button className="btn btn-primary" onClick={runDetect} disabled={loading}>
          {loading ? "Détection en cours…" : "🔍 Détecter les correspondances"}
        </button>
      </div>
    );
  }

  const matches = buildMatches(g61Drivers, dbDrivers);
  const exactCount    = matches.filter((m) => m.status === "exact").length;
  const conflictCount = matches.filter((m) => m.status === "conflict").length;
  const ambiguousCount = matches.filter((m) => m.status === "ambiguous").length;

  const matchedDbIds = new Set(matches.filter((m) => m.dbDriver).map((m) => m.dbDriver.id));
  const notFoundInG61 = dbDrivers.filter((d) => !matchedDbIds.has(d.id) && !d.garage61_slug);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={runDetect} disabled={loading}>
          {loading ? "Actualisation…" : "🔄 Actualiser"}
        </button>
        {lastUpdated && !loading && (
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
            Dernière détection : {new Date(lastUpdated).toLocaleString(locale)}
          </span>
        )}
        {exactCount > 0 && (
          <button className="btn btn-primary" onClick={() => applyExact(matches)} disabled={saving}>
            {saving ? "Enregistrement…" : `✓ Appliquer ${exactCount} correspondance${exactCount > 1 ? "s" : ""} exacte${exactCount > 1 ? "s" : ""}`}
          </button>
        )}
        {savedCount !== null && (
          <span style={{ fontSize: "0.82rem", color: "#2eb460" }}>
            {savedCount} slug{savedCount > 1 ? "s" : ""} enregistré{savedCount > 1 ? "s" : ""}.
          </span>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Detection account */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>Compte de détection :</span>
        <select
          value={detectionDriverId}
          onChange={(e) => saveDetectionDriver(e.target.value)}
          style={{ fontSize: "0.82rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)", padding: "0.25rem 0.5rem" }}
        >
          <option value="">Compte connecté (par défaut)</option>
          {linkedDrivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          Choisissez un pilote membre de toutes les équipes.
        </span>
      </div>

      {/* Warning summary */}
      {(conflictCount > 0 || ambiguousCount > 0) && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {conflictCount > 0 && (
            <div style={{ fontSize: "0.82rem", color: "#e07b39" }}>
              ⚠ {conflictCount} conflit{conflictCount > 1 ? "s" : ""} — le slug en base diffère de celui détecté sur Garage61.
            </div>
          )}
          {ambiguousCount > 0 && (
            <div style={{ fontSize: "0.82rem", color: "#c9a84c" }}>
              ⚠ {ambiguousCount} correspondance{ambiguousCount > 1 ? "s" : ""} ambiguë{ambiguousCount > 1 ? "s" : ""} — plusieurs pilotes ont le même nom normalisé.
            </div>
          )}
        </div>
      )}

      {/* Main match table */}
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
          Pilotes détectés sur Garage61 ({g61Drivers.length})
        </div>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nom Garage61</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Pilote en base</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => {
                const meta = STATUS_META[m.status];
                return (
                  <tr key={m.g61.slug} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    <td style={tdStyle}>{m.g61.name}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem", color: "var(--text-dim)" }}>{m.g61.slug}</td>
                    <td style={tdStyle}>
                      {m.status === "ambiguous" ? (
                        <span style={{ color: "#c9a84c", fontSize: "0.8rem" }}>
                          {m.candidates.map((c) => c.name).join(", ")}
                        </span>
                      ) : m.status === "conflict" ? (
                        <span>
                          {m.dbDriver.name}
                          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", color: "#e07b39", marginLeft: "0.5rem" }}>
                            (actuellement : {m.dbDriver.garage61_slug})
                          </span>
                        </span>
                      ) : m.dbDriver ? (
                        m.dbDriver.name
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: meta.color }}>{meta.label}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {(m.status === "conflict" || m.status === "fuzzy") && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "0.72rem" }}
                          onClick={() => applyOverride(m.dbDriver.id, m.g61.slug)}
                        >
                          {m.status === "fuzzy" ? "Lier" : "Mettre à jour"}
                        </button>
                      )}
                      {m.status === "ambiguous" && (
                        <select
                          style={{ fontSize: "0.78rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", color: "var(--text)", padding: "0.2rem 0.4rem" }}
                          defaultValue=""
                          onChange={(e) => e.target.value && applyOverride(e.target.value, m.g61.slug)}
                        >
                          <option value="">Assigner à…</option>
                          {m.candidates.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DB drivers not found on Garage61 */}
      {notFoundInG61.length > 0 && (
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
            Pilotes non trouvés sur Garage61 ({notFoundInG61.length})
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
            Ces pilotes approuvés n&apos;ont pas de correspondance dans les données d&apos;équipe Garage61 et n&apos;ont pas encore lié leur compte.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {notFoundInG61.map((d) => (
              <span key={d.id} style={{ padding: "0.2rem 0.6rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                {d.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
