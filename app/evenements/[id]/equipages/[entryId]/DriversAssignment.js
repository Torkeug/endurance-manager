"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";

// ── PreferenceBadge ───────────────────────────────────────────────────────
// Consolidated mismatch badge. Replaces the old MismatchBadge +
// StartTimeMismatchBadge pair. Shows a single pill with all conflicts listed,
// coloured by worst severity:
//   🔴 hard  — class doesn't match (the driver fundamentally doesn't fit)
//   🟡 soft  — class matches but preferred car(s) don't, or start time differs
//
// Props:
//   signup          — signup row (preferred_car_ids, preferred_class, preferred_start_time_ids)
//   entryCarId      — UUID of the car this team entry is running
//   entryCarName    — human-readable name of that car
//   entryClass      — class string of this team entry
//   carsMap         — { [carId]: carName } for preferred car name resolution
//   teamStartTimeId — UUID of the team's chosen start time
//   startTimesMap   — { [startTimeId]: label } for start time name resolution
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

  // Collect individual conflict descriptors
  const conflicts = []; // { label, tooltip, hard }

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

  // ── Car check (soft — only relevant when class matches) ─────────────────
  // We only warn about car if the class is fine (or unspecified), so admins
  // aren't double-penalised for a car difference inside an already-flagged class.
  const carConflict =
    !classConflict &&
    prefCarIds.length > 0 &&
    entryCarId &&
    !prefCarIds.includes(entryCarId);
  if (carConflict) {
    // Resolve preferred car names from the map; fall back to raw IDs if missing.
    const prefCarNames = prefCarIds.map((id) => carsMap?.[id] || id).join(", ");
    conflicts.push({
      label: "voiture",
      tooltip: `Voiture équipe : ${entryCarName || entryCarId} — pilote préfère : ${prefCarNames}\nLa classe correspond (${entryClass}).`,
      hard: false,
    });
  }

  // ── Start time check (soft) ─────────────────────────────────────────────
  // Only consider preferred IDs that resolve in the map — stale IDs from
  // event type conversion (regular→special or vice versa) are silently
  // ignored rather than shown as raw UUIDs or flagged as false mismatches.
  const resolvablePrefStartTimeIds = prefStartTimeIds.filter(
    (id) => startTimesMap?.[id],
  );
  const startConflict =
    teamStartTimeId &&
    startTimesMap?.[teamStartTimeId] && // team's time must resolve too
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

  // Worst severity wins for colour
  const isHard = conflicts.some((c) => c.hard);
  const badgeStyle = isHard
    ? {
        // 🔴 hard — class mismatch
        background: "rgba(224,85,85,0.12)",
        border: "1px solid var(--danger)",
        color: "var(--danger)",
      }
    : {
        // 🟡 soft — car or start time mismatch within matching class
        background: "#2a1a00",
        border: "1px solid #a06020",
        color: "#d4904a",
      };

  // Build a single multi-line tooltip listing every conflict
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

export default function DriversAssignment({
  entryId,
  entryCarId,
  entryCarName, // human-readable team car name for tooltips
  entryClass,
  carsMap, // { [carId]: carName }
  startTimesMap, // { [startTimeId]: label }
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
  // teamStartTimeId: used to flag drivers whose preferred start times don't match
  teamStartTimeId = null,
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

  // Returns true if any preference conflict exists — used to style the pill button
  // in the unassigned section (amber border + warning icon).
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

    // Soft: class ok (or unspecified), but car preference doesn't include team car
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

    // Soft: start time mismatch
    if (
      teamStartTimeId &&
      prefStartTimeIds.length > 0 &&
      !prefStartTimeIds.includes(teamStartTimeId)
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
