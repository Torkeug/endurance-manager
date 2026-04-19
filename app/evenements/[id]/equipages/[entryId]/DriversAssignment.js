"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";

function MismatchBadge({ signup, entryCarId, entryClass }) {
  const prefCarIds = signup.preferred_car_ids || [];
  const prefClasses = signup.preferred_class || [];

  if (prefCarIds.length > 0 && entryCarId && !prefCarIds.includes(entryCarId)) {
    return (
      <span
        title="Voiture préférée différente"
        style={{
          fontSize: "0.7rem",
          padding: "0.15rem 0.4rem",
          background: "#2a1a00",
          border: "1px solid #a06020",
          borderRadius: "2px",
          color: "#d4904a",
          whiteSpace: "nowrap",
        }}
      >
        ⚠️ voiture
      </span>
    );
  }
  if (
    prefClasses.length > 0 &&
    entryClass &&
    !prefClasses.includes(entryClass)
  ) {
    return (
      <span
        title={`Classe préférée : ${prefClasses.join(", ")}`}
        style={{
          fontSize: "0.7rem",
          padding: "0.15rem 0.4rem",
          background: "#2a1a00",
          border: "1px solid #a06020",
          borderRadius: "2px",
          color: "#d4904a",
          whiteSpace: "nowrap",
        }}
      >
        ⚠️ {prefClasses.join(", ")}
      </span>
    );
  }
  return null;
}

export default function DriversAssignment({
  entryId,
  entryCarId,
  entryClass,
  assignedDrivers,
  unassignedDrivers,
  currentDriver,
  // archived — when true all assign/unassign actions are hidden
  archived = false,
  isInEvent = false,
  // isInTeam: current driver is already in this team entry
  isInTeam = false,
  // isAdmin: passed explicitly from EquipageTabs so we don't recompute
  isAdmin = false,
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState(assignedDrivers);
  const [unassigned, setUnassigned] = useState(unassignedDrivers);
  const [error, setError] = useState(null);
  // Stores the signup ID being assigned — shows loading on the specific button
  const [assigning, setAssigning] = useState(null);

  const isExternal = currentDriver?.role === "external";

  const assign = async (signup) => {
    if (assigning || archived) return;
    setAssigning(signup.id);
    const { data, error: err } = await supabase
      .from("signups")
      .update({ team_entry_id: entryId })
      .eq("id", signup.id)
      .select();
    if (err || !data || data.length === 0) {
      setError(err?.message || "Update failed (RLS ou contrainte)");
      setAssigning(null);
      return;
    }
    setAssigned((prev) => [...prev, { ...signup, team_entry_id: entryId }]);
    setUnassigned((prev) => prev.filter((s) => s.id !== signup.id));
    setAssigning(null);
    router.refresh();
  };

  const unassign = async (signup) => {
    if (archived) return;
    const { error: err } = await supabase
      .from("signups")
      .update({ team_entry_id: null })
      .eq("id", signup.id);
    if (err) {
      setError(err.message);
      return;
    }
    setUnassigned((prev) => [...prev, { ...signup, team_entry_id: null }]);
    setAssigned((prev) => prev.filter((s) => s.id !== signup.id));
    router.refresh();
  };

  const hasMismatch = (signup) => {
    const prefCarIds = signup.preferred_car_ids || [];
    const prefClasses = signup.preferred_class || [];
    if (prefCarIds.length === 0 && prefClasses.length === 0) return false;
    if (prefCarIds.length > 0)
      return entryCarId ? !prefCarIds.includes(entryCarId) : false;
    return entryClass ? !prefClasses.includes(entryClass) : false;
  };

  // ── Unassigned list filtering ─────────────────────────────────────────────
  // Admin: sees everyone not yet assigned to this team
  // Event driver not in team (self-assign flow): sees only their own signup
  // In team but not admin: sees everyone not yet assigned to this team
  const visibleUnassigned = (() => {
    if (archived) return [];
    if (isAdmin) return unassigned;
    if (!isInEvent) return [];
    if (!isInTeam) {
      return unassigned.filter((s) => s.drivers?.id === currentDriver?.id);
    }
    return unassigned;
  })();

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* ── Assigned drivers table ── */}
      {assigned.length === 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="empty" style={{ padding: "1.5rem" }}>
            Aucun pilote assigné à cette équipe.
          </div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: "1rem" }}>
          <table>
            <thead>
              <tr>
                <th>Pilote</th>
                <th>iRating</th>
                <th>Préférences</th>
                <th>Notes</th>
                {!archived && <th></th>}
              </tr>
            </thead>
            <tbody>
              {assigned.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {s.drivers?.name || "—"}
                      <MismatchBadge
                        signup={s}
                        entryCarId={entryCarId}
                        entryClass={entryClass}
                      />
                    </div>
                  </td>
                  <td
                    className="mono"
                    style={{ color: "var(--accent)", fontSize: "0.85rem" }}
                  >
                    {s.drivers?.irating ?? "—"}
                  </td>
                  <td style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                    {[...(s.preferred_class || [])].join(", ") || "—"}
                  </td>
                  <td
                    style={{
                      color: "var(--text-dim)",
                      fontSize: "0.85rem",
                      maxWidth: "180px",
                    }}
                  >
                    {s.notes || "—"}
                  </td>
                  {/* Retirer: only the driver themselves or an admin can remove.
                      External drivers and engineers cannot unassign anyone. */}
                  {!archived && (
                    <td>
                      {!isExternal &&
                        (isAdmin || s.drivers?.id === currentDriver?.id) && (
                          <button
                            onClick={() => unassign(s)}
                            className="btn btn-secondary btn-sm"
                            title="Pilote concerné ou admin uniquement"
                          >
                            Retirer
                          </button>
                        )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Unassigned section ── */}
      {visibleUnassigned.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              marginBottom: "0.75rem",
            }}
          >
            {isAdmin || isInTeam
              ? "Pilotes inscrits sans équipe"
              : "Rejoindre cet équipage"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {visibleUnassigned.map((s) => {
              const mismatch = hasMismatch(s);
              return (
                <button
                  key={s.id}
                  onClick={() => assign(s)}
                  className="btn btn-secondary"
                  disabled={!!assigning}
                  title={
                    mismatch ? "Préférence différente de cette équipe" : ""
                  }
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "0.1rem",
                    borderColor: mismatch ? "#a06020" : undefined,
                    opacity: assigning === s.id ? 0.5 : 1,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    {mismatch && <span style={{ color: "#d4904a" }}>⚠️</span>}
                    <span style={{ fontWeight: 600 }}>{s.drivers?.name}</span>
                  </span>
                  {s.drivers?.irating && (
                    <span
                      className="mono"
                      style={{ fontSize: "0.75rem", color: "var(--accent)" }}
                    >
                      {s.drivers.irating}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
