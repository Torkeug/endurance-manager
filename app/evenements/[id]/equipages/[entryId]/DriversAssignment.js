"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";

// ── PreferenceBadge ───────────────────────────────────────────────────────
// Consolidated mismatch badge. Shows a single pill with all conflicts listed,
// coloured by worst severity:
//   🔴 hard  — class doesn't match (the driver fundamentally doesn't fit)
//   🟡 soft  — class matches but preferred car(s) don't, or start time differs
function PreferenceBadge({
  signup,
  entryCarId,
  entryCarName,
  entryClass,
  carsMap,
  teamStartTimeId,
  startTimesMap,
}) {
  const prefCarIds = signup.preferred_car_ids || [];
  const prefClasses = signup.preferred_class || [];
  const prefStartTimeIds = signup.preferred_start_time_ids || [];

  const conflicts = [];

  // ── Class check (hard mismatch) ─────────────────────────────────────────
  const classConflict =
    prefClasses.length > 0 && entryClass && !prefClasses.includes(entryClass);
  if (classConflict) {
    conflicts.push({
      label: "classe",
      tooltip: `Classe équipe : ${entryClass} — pilote préfère : ${prefClasses.join(", ")}`,
      hard: true,
    });
  }

  // ── Car check (soft — only when class matches) ──────────────────────────
  const carConflict =
    !classConflict &&
    prefCarIds.length > 0 &&
    entryCarId &&
    !prefCarIds.includes(entryCarId);
  if (carConflict) {
    const prefCarNames = prefCarIds.map((id) => carsMap?.[id] || id).join(", ");
    conflicts.push({
      label: "voiture",
      tooltip: `Voiture équipe : ${entryCarName || entryCarId} — pilote préfère : ${prefCarNames}\nLa classe correspond (${entryClass}).`,
      hard: false,
    });
  }

  // ── Start time check (soft) ─────────────────────────────────────────────
  // Only consider IDs that resolve in the map — stale IDs from event type
  // conversion are silently ignored rather than flagged as false mismatches.
  const resolvablePrefStartTimeIds = prefStartTimeIds.filter(
    (id) => startTimesMap?.[id],
  );
  const startConflict =
    teamStartTimeId &&
    startTimesMap?.[teamStartTimeId] &&
    resolvablePrefStartTimeIds.length > 0 &&
    !resolvablePrefStartTimeIds.includes(teamStartTimeId);
  if (startConflict) {
    const teamLabel = startTimesMap[teamStartTimeId];
    const prefLabels = resolvablePrefStartTimeIds
      .map((id) => startTimesMap[id])
      .join(", ");
    conflicts.push({
      label: "horaire",
      tooltip: `Horaire équipe : ${teamLabel} — pilote préfère : ${prefLabels}`,
      hard: false,
    });
  }

  if (conflicts.length === 0) return null;

  const isHard = conflicts.some((c) => c.hard);
  const badgeStyle = isHard
    ? {
        background: "rgba(224,85,85,0.12)",
        border: "1px solid var(--danger)",
        color: "var(--danger)",
      }
    : {
        background: "#2a1a00",
        border: "1px solid #a06020",
        color: "#d4904a",
      };

  const fullTooltip = conflicts.map((c) => c.tooltip).join("\n\n");
  const labelText = conflicts.map((c) => c.label).join(", ");

  return (
    <span
      title={fullTooltip}
      style={{
        fontSize: "0.7rem",
        padding: "0.15rem 0.4rem",
        borderRadius: "2px",
        whiteSpace: "nowrap",
        cursor: "help",
        ...badgeStyle,
      }}
    >
      ⚠️ {labelText}
    </span>
  );
}

// ── StartTimeModal ────────────────────────────────────────────────────────
// Shown on assign (offer to add team start time to driver prefs) and on
// unassign (offer to remove it, only when it wasn't in the pre-assignment snapshot).
function StartTimeModal({ modal, onConfirm, onDecline, onClose }) {
  if (!modal) return null;

  const isAssign = modal.type === "assign";
  const title = isAssign
    ? "Préférence d'horaire"
    : "Retirer la préférence d'horaire";
  const message = isAssign
    ? `Cet équipage démarre le ${modal.startTimeLabel}. Souhaitez-vous ajouter ce créneau aux préférences du pilote ?`
    : `Ce pilote avait été assigné au créneau ${modal.startTimeLabel}. Souhaitez-vous retirer ce créneau de ses préférences ?`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ maxWidth: "420px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>{title}</h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          {message}
        </p>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button onClick={onConfirm} className="btn btn-primary">
            {isAssign ? "Oui, ajouter le créneau" : "Oui, retirer le créneau"}
          </button>
          <button onClick={onDecline} className="btn btn-secondary">
            {isAssign
              ? "Non, laisser les préférences inchangées"
              : "Non, conserver les préférences"}
          </button>
          <button onClick={onClose} className="btn btn-danger btn-sm">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DriversAssignment({
  entryId,
  entryCarId,
  entryCarName,
  entryClass,
  carsMap,
  startTimesMap,
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
  // teamStartTimeId: used to flag and cascade start time preferences
  teamStartTimeId = null,
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState(assignedDrivers);
  const [unassigned, setUnassigned] = useState(unassignedDrivers);
  const [error, setError] = useState(null);
  // Stores the signup ID being assigned — shows loading on the specific button
  const [assigning, setAssigning] = useState(null);
  // Controls the start time preference modal for both assign and unassign flows
  const [actionModal, setActionModal] = useState(null);
  // null | { type: 'assign' | 'unassign', signup, startTimeLabel, onConfirm, onDecline }

  const isExternal = currentDriver?.role === "external";

  // ── Assign helpers ────────────────────────────────────────────────────────

  // Commits the actual DB assign after modal interaction.
  // updatePrefs: true = add teamStartTimeId to preferred_start_time_ids.
  const commitAssign = async (signup, updatePrefs) => {
    setAssigning(signup.id);
    setActionModal(null);

    // Snapshot current preferences before any modification so we can safely
    // reverse on unassign — only remove what we actually added.
    const currentPrefs = signup.preferred_start_time_ids || [];
    const snapshot = currentPrefs;

    // Build updated preferences if the admin/driver confirmed the addition
    const newPrefs =
      updatePrefs && teamStartTimeId && !currentPrefs.includes(teamStartTimeId)
        ? [...currentPrefs, teamStartTimeId]
        : currentPrefs;

    // Save snapshot + updated preferences on the signup row, then assign to team
    const { error: prefErr } = await supabase
      .from("signups")
      .update({
        preferred_start_time_ids: newPrefs,
        preferred_start_time_ids_snapshot: snapshot,
      })
      .eq("id", signup.id);

    if (prefErr) {
      setError(prefErr.message);
      setAssigning(null);
      return;
    }

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

    setAssigned((prev) => [
      ...prev,
      {
        ...signup,
        team_entry_id: entryId,
        preferred_start_time_ids: newPrefs,
        preferred_start_time_ids_snapshot: snapshot,
      },
    ]);
    setUnassigned((prev) => prev.filter((s) => s.id !== signup.id));
    setAssigning(null);
    router.refresh();
  };

  const assign = (signup) => {
    if (assigning || archived) return;

    // No team start time configured — assign silently, no modal needed
    if (!teamStartTimeId) {
      commitAssign(signup, false);
      return;
    }

    const currentPrefs = signup.preferred_start_time_ids || [];

    // Start time already in driver's preferences — assign silently
    if (currentPrefs.includes(teamStartTimeId)) {
      commitAssign(signup, false);
      return;
    }

    // Start time not in preferences — prompt to add it
    const startTimeLabel = startTimesMap?.[teamStartTimeId] || teamStartTimeId;
    setActionModal({
      type: "assign",
      signup,
      startTimeLabel,
      onConfirm: () => commitAssign(signup, true),
      onDecline: () => commitAssign(signup, false),
    });
  };

  // ── Unassign helpers ──────────────────────────────────────────────────────

  // Commits the actual DB unassign after modal interaction.
  // removeStartTime: true = strip teamStartTimeId from preferred_start_time_ids.
  const commitUnassign = async (signup, removeStartTime) => {
    setActionModal(null);

    const currentPrefs = signup.preferred_start_time_ids || [];
    const newPrefs = removeStartTime
      ? currentPrefs.filter((id) => id !== teamStartTimeId)
      : currentPrefs;

    if (removeStartTime) {
      await supabase
        .from("signups")
        .update({ preferred_start_time_ids: newPrefs })
        .eq("id", signup.id);
    }

    const { error: err } = await supabase
      .from("signups")
      .update({
        team_entry_id: null,
        // Clear the snapshot on unassign — it was tied to this specific
        // assignment. A fresh snapshot will be taken on the next assignment.
        preferred_start_time_ids_snapshot: null,
      })
      .eq("id", signup.id);

    if (err) {
      setError(err.message);
      return;
    }

    setUnassigned((prev) => [
      ...prev,
      {
        ...signup,
        team_entry_id: null,
        preferred_start_time_ids: newPrefs,
      },
    ]);
    setAssigned((prev) => prev.filter((s) => s.id !== signup.id));
    router.refresh();
  };

  const unassign = (signup) => {
    if (archived) return;

    // No team start time — unassign silently
    if (!teamStartTimeId) {
      commitUnassign(signup, false);
      return;
    }

    const snapshot = signup.preferred_start_time_ids_snapshot;

    // Snapshot is NULL (assigned before this feature existed) — keep prefs,
    // unassign silently to avoid incorrectly stripping pre-existing preferences.
    if (!snapshot) {
      commitUnassign(signup, false);
      return;
    }

    // Start time was already in prefs before assignment — keep it
    if (snapshot.includes(teamStartTimeId)) {
      commitUnassign(signup, false);
      return;
    }

    // Start time was added during assignment — prompt to remove it
    const startTimeLabel = startTimesMap?.[teamStartTimeId] || teamStartTimeId;
    setActionModal({
      type: "unassign",
      signup,
      startTimeLabel,
      onConfirm: () => commitUnassign(signup, true),
      onDecline: () => commitUnassign(signup, false),
    });
  };

  // ── Mismatch detection ────────────────────────────────────────────────────
  // Returns true if any preference conflict exists — used to style the pill
  // button in the unassigned section (amber border + warning icon).
  const hasMismatch = (signup) => {
    const prefCarIds = signup.preferred_car_ids || [];
    const prefClasses = signup.preferred_class || [];
    const prefStartTimeIds = signup.preferred_start_time_ids || [];

    // Hard: class doesn't match
    if (
      prefClasses.length > 0 &&
      entryClass &&
      !prefClasses.includes(entryClass)
    )
      return true;

    // Soft: class ok (or unspecified), but preferred car doesn't include team car
    const classOk =
      prefClasses.length === 0 ||
      !entryClass ||
      prefClasses.includes(entryClass);
    if (
      classOk &&
      prefCarIds.length > 0 &&
      entryCarId &&
      !prefCarIds.includes(entryCarId)
    )
      return true;

    // Soft: start time mismatch (only resolvable IDs count)
    const resolvable = prefStartTimeIds.filter((id) => startTimesMap?.[id]);
    if (
      teamStartTimeId &&
      startTimesMap?.[teamStartTimeId] &&
      resolvable.length > 0 &&
      !resolvable.includes(teamStartTimeId)
    )
      return true;

    return false;
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

  // Shared badge props — avoids repeating the full prop list at every call site
  const badgeProps = (signup) => ({
    signup,
    entryCarId,
    entryCarName,
    entryClass,
    carsMap,
    teamStartTimeId,
    startTimesMap,
  });

  return (
    <div>
      {/* ── Start time preference modal ── */}
      <StartTimeModal
        modal={actionModal}
        onConfirm={() => actionModal?.onConfirm?.()}
        onDecline={() => actionModal?.onDecline?.()}
        onClose={() => setActionModal(null)}
      />

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
                      {/* Single consolidated badge replacing the old two-badge system */}
                      <PreferenceBadge {...badgeProps(s)} />
                    </div>
                  </td>
                  <td
                    className="mono"
                    style={{ color: "var(--accent)", fontSize: "0.85rem" }}
                  >
                    {s.drivers?.irating ?? "—"}
                  </td>
                  <td style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                    {(() => {
                      const classes = s.preferred_class || [];
                      // Resolve preferred car IDs to human-readable names via carsMap
                      const carNames = (s.preferred_car_ids || [])
                        .map((id) => carsMap?.[id])
                        .filter(Boolean);
                      const parts = [...classes, ...carNames];
                      return parts.length > 0 ? parts.join(", ") : "—";
                    })()}
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
                  {/* Consolidated badge inside the unassigned pill */}
                  {mismatch && <PreferenceBadge {...badgeProps(s)} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
