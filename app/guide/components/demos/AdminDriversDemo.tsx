"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import AdminDemoShell from "./AdminDemoShell";

const TH: CSSProperties = {
  background: "var(--surface-2)", color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.6rem 1rem",
  textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
};
const TH_TIGHT: CSSProperties = { ...TH as object, textAlign: "center", padding: "0.6rem 0.5rem" } as CSSProperties;
const TD: CSSProperties = { padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };
const TD_TIGHT: CSSProperties = { ...TD as object, textAlign: "center", padding: "0.5rem 0.5rem" } as CSSProperties;

const ROLE_COLORS: Record<string, string> = {
  driver: "var(--text-dim)", engineer: "#f59e0b", admin: "var(--accent)", super_admin: "#e05555",
};
const ROLE_LABELS: Record<string, string> = {
  driver: "Pilote", engineer: "Ingénieur", admin: "Admin", super_admin: "Super Admin",
};

const PENDING = [
  { name: "Paul Renard",  email: "paul@example.fr", iracing_id: "348821", discord: "paul#4321" },
  { name: "Camille Roy",  email: "cam@example.fr",  iracing_id: "",       discord: "" },
];

const APPROVED = [
  { name: "Raphaël Laurent", role: "super_admin", email: "raph@kronos.fr",  discord_id: "raph#0001", membership: true,  test: false, active: true,  sync: "01/06/26", isMe: true },
  { name: "Marc Dubois",      role: "admin",       email: "marc@kronos.fr",  discord_id: "marc#1234", membership: true,  test: false, active: true,  sync: "01/06/26", isMe: false },
  { name: "Léa Fontaine",     role: "driver",      email: "lea@kronos.fr",   discord_id: "—",         membership: true,  test: false, active: true,  sync: "21/01/26", isMe: false },
  { name: "Théo Bernard",     role: "engineer",    email: "theo@kronos.fr",  discord_id: "theo#9999", membership: false, test: false, active: true,  sync: "—",        isMe: false },
  { name: "Jules Martin",     role: "driver",      email: "jules@kronos.fr", discord_id: "—",         membership: true,  test: true,  active: false, sync: "—",        isMe: false },
];

const REFUSED = [
  { name: "Inconnu 123", email: "spam@example.com", iracing_id: "", discord: "" },
];

type Tab = "pending" | "all" | "refused";

export default function AdminDriversDemo() {
  const [tab, setTab] = useState<Tab>("all");

  const tabs: { id: Tab; label: string; danger?: boolean }[] = [
    { id: "pending",  label: `En attente (${PENDING.length})`,   danger: true },
    { id: "all",      label: `Approuvés (${APPROVED.length})` },
    { id: "refused",  label: `Refusés (${REFUSED.length})` },
  ];

  return (
    <AdminDemoShell activeTab="pilotes">
    <div>
      {/* Sync All + tab pills */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <a className="btn btn-secondary btn-sm">🔄 Sync All iRacing</a>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {tabs.map(({ id, label, danger }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "0.4rem 1rem", borderRadius: "3px", border: "1px solid",
              borderColor: active ? "var(--accent)" : danger ? "var(--danger)" : "var(--border)",
              background: active ? "var(--accent-dim)" : danger ? "rgba(224,85,85,0.1)" : "var(--surface-2)",
              color: active ? "var(--accent)" : danger ? "var(--danger)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani),sans-serif", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
            }}>{label}</button>
          );
        })}
      </div>

      {/* En attente */}
      {tab === "pending" && (
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Nom</th>
                <th style={TH}>Email</th>
                <th style={TH}>iRacing ID</th>
                <th style={TH}>Discord</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {PENDING.map((d) => (
                <tr key={d.name}>
                  <td style={{ ...TD, fontWeight: 600 }}>{d.name}</td>
                  <td className="mono" style={{ ...TD, fontSize: "0.82rem" }}>{d.email || "—"}</td>
                  <td className="mono" style={TD}>{d.iracing_id || "—"}</td>
                  <td style={TD}>{d.discord || "—"}</td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button className="btn btn-primary btn-sm">✓ Approuver</button>
                      <button className="btn btn-danger btn-sm">✗ Refuser</button>
                      <button className="btn btn-secondary btn-sm">Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approuvés */}
      {tab === "all" && (
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "750px" }}>
            <thead>
              <tr>
                <th style={TH}>Nom</th>
                <th style={TH}>Email</th>
                <th style={TH}>Rôle</th>
                <th style={TH}>Discord ID</th>
                <th style={TH_TIGHT}>Cotis.</th>
                <th style={TH_TIGHT}>Test</th>
                <th style={TH_TIGHT}>Actif</th>
                <th style={TH_TIGHT}>iRacing sync</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {APPROVED.map((d) => (
                <tr key={d.name}>
                  <td style={TD}>
                    <span style={{ fontWeight: 600 }}>{d.name}</span>
                    {d.isMe && <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "var(--accent)" }}>(vous)</span>}
                  </td>
                  <td style={{ ...TD, fontSize: "0.82rem", maxWidth: "160px", whiteSpace: "nowrap" }}>
                    <span className="mono">{d.email}</span>
                    {" "}<span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>📋</span>
                  </td>
                  <td style={TD}>
                    {d.isMe || d.role === "super_admin" ? (
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: ROLE_COLORS[d.role] }}>{ROLE_LABELS[d.role]}</span>
                    ) : (
                      <select defaultValue={d.role} style={{
                        background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "3px",
                        color: ROLE_COLORS[d.role], fontFamily: "var(--font-rajdhani),sans-serif",
                        fontSize: "0.85rem", fontWeight: 700, padding: "0.25rem 0.5rem", cursor: "pointer",
                      }}>
                        <option value="driver">Pilote</option>
                        <option value="engineer">Ingénieur</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}>
                    <span className="mono" style={{ fontSize: "0.82rem" }}>{d.discord_id}</span>
                    {" "}<span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>✏️</span>
                  </td>
                  <td style={TD_TIGHT}><input type="checkbox" readOnly checked={d.membership} style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }} /></td>
                  <td style={TD_TIGHT}><input type="checkbox" readOnly checked={d.test} style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }} /></td>
                  <td style={TD_TIGHT}><input type="checkbox" readOnly checked={d.active} style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }} /></td>
                  <td style={{ ...TD_TIGHT, width: "90px" }}>
                    <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{d.sync}</span>
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    {!d.isMe && d.role === "driver" && (
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary btn-sm">Révoquer</button>
                        <button className="btn btn-danger btn-sm">Supprimer</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Refusés */}
      {tab === "refused" && (
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Nom</th>
                <th style={TH}>Email</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {REFUSED.map((d) => (
                <tr key={d.name}>
                  <td style={{ ...TD, fontWeight: 600 }}>{d.name}</td>
                  <td className="mono" style={{ ...TD, fontSize: "0.82rem" }}>{d.email}</td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <button className="btn btn-primary btn-sm">✓ Approuver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </AdminDemoShell>
  );
}
