"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

const ROLE_LABELS = {
  driver: "Pilote",
  external: "Externe",
  // Engineer is a race-day role: full read access, stint interaction only
  engineer: "Ingénieur",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_COLORS = {
  driver: "var(--text-dim)",
  external: "#9147ff",
  // Amber — distinct from admin gold and driver grey
  engineer: "#f59e0b",
  admin: "var(--accent)",
  super_admin: "#e05555",
};

// Role hierarchy: super_admin can change anyone except other super_admins.
// Admin can only change drivers and externals — cannot touch other admins.
// Returns null if the current user cannot change this target's role at all.
function getAllowedRoles(currentRole, targetRole, targetId, currentDriverId) {
  // Can't change own role
  if (targetId === currentDriverId) return null;
  if (currentRole === "super_admin") {
    // Super admin can promote/demote anyone except other super_admins
    if (targetRole === "super_admin") return null;
    return ["driver", "external", "engineer", "admin"];
  }
  if (currentRole === "admin") {
    // Admin can promote drivers/externals/engineers, cannot touch other admins or super_admins
    if (targetRole === "admin" || targetRole === "super_admin") return null;
    return ["driver", "external", "engineer"];
  }
  return null;
}

// Separate from role changing — controls whether Révoquer/Supprimer buttons appear.
// Admins can only revoke plain drivers, not other admins or super_admins.
function canApproveOrRevoke(
  currentRole,
  targetRole,
  targetId,
  currentDriverId,
) {
  if (targetId === currentDriverId) return false;
  if (currentRole === "super_admin") return targetRole !== "super_admin";
  // Admins can revoke drivers and engineers — not other admins or super_admins
  if (currentRole === "admin")
    return targetRole === "driver" || targetRole === "engineer";
  return false;
}

// Shown before deleting a driver that has active signups.
// Lists affected events so the admin can make an informed decision.
// Note: drivers with stints cannot be deleted at all (FK constraint) —
// this modal only appears for drivers with signups but no stints.
function DeleteDriverModal({ modal, onConfirm, onCancel }) {
  if (!modal) return null;
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
      <div className="card" style={{ maxWidth: "480px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>
          Supprimer {modal.driverName}
        </h3>

        {/* Stints warning — will be deleted explicitly before driver */}
        {modal.hasStints && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.65rem 0.9rem",
              background: "rgba(224,85,85,0.08)",
              border: "1px solid var(--danger)",
              borderRadius: "3px",
              fontSize: "0.88rem",
              color: "var(--danger)",
            }}
          >
            ⚠️ Ce pilote a des relais assignés qui seront supprimés
            définitivement.
          </div>
        )}

        {/* Signups — informational, will cascade-delete */}
        {modal.affectedEvents.length > 0 && (
          <>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-dim)",
                marginBottom: "0.75rem",
              }}
            >
              Ce pilote est inscrit à{" "}
              <strong style={{ color: "var(--text)" }}>
                {modal.affectedEvents.length} événement
                {modal.affectedEvents.length > 1 ? "s" : ""}
              </strong>
              . Ces inscriptions seront supprimées automatiquement :
            </p>
            <ul
              style={{
                margin: "0 0 1rem",
                paddingLeft: "1.25rem",
                fontSize: "0.88rem",
                color: "var(--danger)",
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              {modal.affectedEvents.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </>
        )}

        {/* Clean delete */}
        {!modal.hasStints && modal.affectedEvents.length === 0 && (
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text-dim)",
              marginBottom: "1.5rem",
            }}
          >
            Confirmer la suppression définitive de{" "}
            <strong style={{ color: "var(--text)" }}>{modal.driverName}</strong>{" "}
            ? Cette action est irréversible.
          </p>
        )}

        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          Cette action est irréversible.
        </p>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button onClick={onConfirm} className="btn btn-danger">
            Supprimer définitivement
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DriversManager({ initialDrivers, currentDriver }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Number of drivers synced in the last sync-all run (from redirect param)
  const iracingSyncedCount = searchParams.get("iracing_synced");
  const iracingUnauthorized =
    searchParams.get("error") === "iracing_unauthorized";
  const [drivers, setDrivers] = useState(initialDrivers);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");
  // Controls the delete preview modal — null when closed, populated with
  // affected signup data when a driver has active event registrations.
  const [deleteModal, setDeleteModal] = useState(null);
  // null | { driverId, driverName, affectedEvents: [] }

  // Which driver row has its Discord ID pencil editor open, and the draft value
  const [editingDiscord, setEditingDiscord] = useState(null);
  const [discordDraft, setDiscordDraft] = useState("");

  const pending = drivers.filter((d) => !d.approved && !d.refused);
  const refused = drivers.filter((d) => d.refused);
  const approved = drivers.filter((d) => d.approved && !d.refused);

  // Tracks which driver's email was just copied — for the ✓ flash
  const [copiedEmail, setCopiedEmail] = useState(null);

  const approve = async (driverId) => {
    setSaving(driverId);
    setError(null);
    const { error: err } = await supabase
      .from("drivers")
      .update({ approved: true, refused: false })
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId ? { ...d, approved: true, refused: false } : d,
      ),
    );
    setSaving(null);
    router.refresh();

    // Send approval email — fire and forget, failure must not block the approval action
    fetch("/api/notify-driver-approved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_id: driverId }),
    }).catch((e) => console.error("[approve] Email notification failed:", e));
  };

  const refuse = async (driverId) => {
    if (
      !confirm(
        "Refuser cet accès ? Le pilote ne pourra plus se connecter avec cet email.",
      )
    )
      return;
    setSaving(driverId);
    setError(null);
    const { error: err } = await supabase
      .from("drivers")
      .update({ approved: false, refused: true })
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId ? { ...d, approved: false, refused: true } : d,
      ),
    );
    setSaving(null);
    router.refresh();
  };

  // revoke = back to pending (approved: false), distinct from refuse (refused: true)
  const revoke = async (driverId) => {
    if (
      !confirm(
        "Révoquer l'accès de ce pilote ? Il sera mis en attente d'approbation.",
      )
    )
      return;
    setSaving(driverId);
    setError(null);
    const { error: err } = await supabase
      .from("drivers")
      .update({ approved: false })
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, approved: false } : d)),
    );
    setSaving(null);
    router.refresh();
  };

  // Preview signups before deleting — shows affected events in a modal.
  // Drivers with stints are blocked by FK constraint at DB level.
  const deleteDriver = async (driverId, driverName) => {
    // Fetch active signups for this driver to preview impact
    const { data: signups } = await supabase
      .from("signups")
      .select("events(name)")
      .eq("driver_id", driverId);

    const affectedEvents = [
      ...new Set((signups || []).map((s) => s.events?.name).filter(Boolean)),
    ];

    setDeleteModal({ driverId, driverName, affectedEvents });
  };

  const commitDelete = async () => {
    const { driverId } = deleteModal;
    setDeleteModal(null);
    setSaving(driverId);
    setError(null);

    // Delete stints first — FK constraint prevents driver deletion if stints exist.
    // Signups cascade-delete automatically when the driver record is removed.
    if (deleteModal.hasStints) {
      const { error: stintErr } = await supabase
        .from("stints")
        .delete()
        .eq("driver_id", driverId);
      if (stintErr) {
        setError(`Erreur suppression relais : ${stintErr.message}`);
        setSaving(null);
        return;
      }
    }

    const { error: err } = await supabase
      .from("drivers")
      .delete()
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }

    setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    setSaving(null);
    router.refresh();
  };

  const changeRole = async (driverId, role) => {
    setSaving(driverId);
    setError(null);
    const { error: err } = await supabase
      .from("drivers")
      .update({ role })
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, role } : d)),
    );
    setSaving(null);
    router.refresh();
  };

  const toggleMembership = async (driverId, value) => {
    setSaving(driverId);
    const { error: err } = await supabase
      .from("drivers")
      .update({ membership_ok: value })
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, membership_ok: value } : d)),
    );
    setSaving(null);
  };

  const toggleTestDriver = async (driverId, value) => {
    setSaving(driverId);
    const { error: err } = await supabase
      .from("drivers")
      .update({ test_driver: value })
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, test_driver: value } : d)),
    );
    setSaving(null);
  };

  // Open the Discord ID pencil editor for a given driver row
  const openDiscordEdit = (driverId, currentValue) => {
    setEditingDiscord(driverId);
    setDiscordDraft(currentValue || "");
  };

  // Cancel the Discord ID edit without saving
  const cancelDiscordEdit = () => {
    setEditingDiscord(null);
    setDiscordDraft("");
  };

  // Save the edited Discord ID to the DB and update local state
  const saveDiscordId = async (driverId) => {
    setSaving(driverId);
    setError(null);
    const { error: err } = await supabase
      .from("drivers")
      .update({ discord_id: discordDraft.trim() || null })
      .eq("id", driverId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? { ...d, discord_id: discordDraft.trim() || null }
          : d,
      ),
    );
    setSaving(null);
    setEditingDiscord(null);
    setDiscordDraft("");
  };

  const tabs = [
    {
      id: "pending",
      label: `En attente (${pending.length})`,
      danger: pending.length > 0,
    },
    { id: "all", label: `Approuvés (${approved.length})` },
    { id: "refused", label: `Refusés (${refused.length})` },
  ];

  // Copies a driver's email to clipboard and flashes ✓ for 1.5s
  function copyEmail(driverId, email) {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(driverId);
      setTimeout(() => setCopiedEmail(null), 1500);
    });
  }

  return (
    <div>
      {/* Delete preview modal — shows affected events before committing */}
      <DeleteDriverModal
        modal={deleteModal}
        onConfirm={commitDelete}
        onCancel={() => setDeleteModal(null)}
      />

      {/* iRacing sync-all feedback banners */}
      {iracingSyncedCount && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
          ✓ {iracingSyncedCount} pilote{iracingSyncedCount !== "1" ? "s" : ""}{" "}
          synchronisé
          {iracingSyncedCount !== "1" ? "s" : ""} avec iRacing.
        </div>
      )}
      {iracingUnauthorized && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          Accès refusé — seuls les admins peuvent lancer une synchronisation
          globale.
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Sync All iRacing — admin only, triggers OAuth flow with mode=syncall */}
      {["admin", "super_admin"].includes(currentDriver?.role) && (
        <div
          style={{
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <a
            href="/auth/iracing?mode=syncall"
            className="btn btn-secondary btn-sm"
          >
            🔄 Sync All iRacing
          </a>
        </div>
      )}

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "3px",
              border: "1px solid",
              borderColor:
                filter === tab.id
                  ? tab.danger
                    ? "var(--danger)"
                    : "var(--accent)"
                  : "var(--border)",
              background:
                filter === tab.id
                  ? tab.danger
                    ? "rgba(224,85,85,0.1)"
                    : "var(--accent-dim)"
                  : "var(--surface-2)",
              color:
                filter === tab.id
                  ? tab.danger
                    ? "var(--danger)"
                    : "var(--accent)"
                  : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pending */}
      {filter === "pending" &&
        (pending.length === 0 ? (
          <div className="card">
            <div className="empty">
              Aucun pilote en attente d&apos;approbation.
            </div>
          </div>
        ) : (
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
                {pending.map((d) => (
                  <tr key={d.id} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                    <td style={TD}>
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                    </td>
                    <td style={TD} className="mono">
                      {d.email || "—"}
                    </td>
                    <td style={TD} className="mono">
                      {d.iracing_id || "—"}
                    </td>
                    <td style={TD}>{d.discord || "—"}</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          onClick={() => approve(d.id)}
                          className="btn btn-primary btn-sm"
                          disabled={saving === d.id}
                        >
                          ✓ Approuver
                        </button>
                        <button
                          onClick={() => refuse(d.id)}
                          className="btn btn-danger btn-sm"
                          disabled={saving === d.id}
                        >
                          ✗ Refuser
                        </button>
                        <button
                          onClick={() => deleteDriver(d.id, d.name)}
                          className="btn btn-secondary btn-sm"
                          disabled={saving === d.id}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* Approved */}
      {filter === "all" &&
        (approved.length === 0 ? (
          <div className="card">
            <div className="empty">Aucun pilote approuvé.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Nom</th>
                  <th style={TH}>Email</th>
                  <th style={TH}>Rôle</th>
                  {/* Discord ID column — editable via pencil icon */}
                  <th style={TH}>Discord ID</th>
                  <th style={{ ...TH, textAlign: "center" }}>Cotisation</th>
                  <th style={{ ...TH, textAlign: "center" }}>Test</th>
                  {/* iRacing sync — read-only timestamp, populated by sync-all or driver self-sync */}
                  <th style={{ ...TH, textAlign: "center" }}>iRacing sync</th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {approved.map((d) => {
                  const allowedRoles = getAllowedRoles(
                    currentDriver?.role,
                    d.role,
                    d.id,
                    currentDriver?.id,
                  );
                  const canAct = canApproveOrRevoke(
                    currentDriver?.role,
                    d.role,
                    d.id,
                    currentDriver?.id,
                  );
                  const isMe = d.id === currentDriver?.id;
                  const isEditingThisRow = editingDiscord === d.id;

                  return (
                    <tr
                      key={d.id}
                      style={{ opacity: saving === d.id ? 0.5 : 1 }}
                    >
                      {/* Name + (vous) badge */}
                      <td style={TD}>
                        <span style={{ fontWeight: 600 }}>{d.name}</span>
                        {isMe && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              fontSize: "0.72rem",
                              color: "var(--accent)",
                            }}
                          >
                            (vous)
                          </span>
                        )}
                      </td>

                      {/* Email */}
                      <td
                        style={{
                          ...TD,
                          fontSize: "0.82rem",
                          maxWidth: "160px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.email ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.3rem",
                            }}
                          >
                            {/* Truncated email — title shows full address on hover */}
                            <span
                              className="mono"
                              title={d.email}
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                              }}
                            >
                              {d.email}
                            </span>
                            {/* Clipboard copy button — flashes ✓ on success */}
                            <button
                              onClick={() => copyEmail(d.id, d.email)}
                              title="Copier l'adresse email"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color:
                                  copiedEmail === d.id
                                    ? "var(--accent)"
                                    : "var(--text-dim)",
                                fontSize: "0.75rem",
                                padding: "0 0.1rem",
                                flexShrink: 0,
                                lineHeight: 1,
                              }}
                            >
                              {copiedEmail === d.id ? "✓" : "📋"}
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Role — dropdown if editable, plain text otherwise */}
                      <td style={TD}>
                        {allowedRoles ? (
                          <select
                            value={d.role || "driver"}
                            onChange={(e) => changeRole(d.id, e.target.value)}
                            disabled={saving === d.id}
                            style={{
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "3px",
                              color: ROLE_COLORS[d.role] || "var(--text)",
                              fontFamily: "var(--font-rajdhani), sans-serif",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              padding: "0.25rem 0.5rem",
                              cursor: "pointer",
                            }}
                          >
                            {allowedRoles.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: ROLE_COLORS[d.role],
                            }}
                          >
                            {ROLE_LABELS[d.role] || "Pilote"}
                          </span>
                        )}
                      </td>

                      {/* Discord ID — inline pencil editor */}
                      <td style={{ ...TD, whiteSpace: "nowrap" }}>
                        {isEditingThisRow ? (
                          // Inline edit mode: input + save/cancel
                          <div
                            style={{
                              display: "flex",
                              gap: "0.4rem",
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="text"
                              value={discordDraft}
                              onChange={(e) => setDiscordDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveDiscordId(d.id);
                                if (e.key === "Escape") cancelDiscordEdit();
                              }}
                              placeholder="Discord ID"
                              autoFocus
                              className="mono"
                              style={{
                                background: "var(--surface-2)",
                                border: "1px solid var(--accent)",
                                borderRadius: "3px",
                                color: "var(--text)",
                                fontSize: "0.82rem",
                                padding: "0.2rem 0.4rem",
                                width: "110px",
                              }}
                            />
                            <button
                              onClick={() => saveDiscordId(d.id)}
                              className="btn btn-primary btn-sm"
                              disabled={saving === d.id}
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelDiscordEdit}
                              className="btn btn-secondary btn-sm"
                              disabled={saving === d.id}
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          // Display mode: value + pencil button
                          <div
                            style={{
                              display: "flex",
                              gap: "0.4rem",
                              alignItems: "center",
                            }}
                          >
                            <span
                              className="mono"
                              style={{ fontSize: "0.82rem" }}
                            >
                              {d.discord_id || "—"}
                            </span>
                            {/* Discord ID edit — available for all rows, not restricted to canAct */}
                            <button
                              onClick={() =>
                                openDiscordEdit(d.id, d.discord_id)
                              }
                              title="Modifier le Discord ID"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--text-dim)",
                                fontSize: "0.8rem",
                                padding: "0 0.2rem",
                                lineHeight: 1,
                              }}
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Membership checkbox */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={d.membership_ok || false}
                          onChange={(e) =>
                            toggleMembership(d.id, e.target.checked)
                          }
                          disabled={saving === d.id}
                          style={{
                            accentColor: "var(--accent)",
                            width: "16px",
                            height: "16px",
                            cursor: "pointer",
                          }}
                        />
                      </td>

                      {/* Test driver checkbox */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={d.test_driver || false}
                          onChange={(e) =>
                            toggleTestDriver(d.id, e.target.checked)
                          }
                          disabled={saving === d.id}
                          style={{
                            accentColor: "var(--accent)",
                            width: "16px",
                            height: "16px",
                            cursor: "pointer",
                          }}
                        />
                      </td>

                      {/* iRacing sync timestamp — read-only */}
                      <td style={{ ...TD, textAlign: "center", width: "90px" }}>
                        {d.iracing_synced_at ? (
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-dim)",
                            }}
                          >
                            {new Date(d.iracing_synced_at).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                              },
                            )}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "var(--text-dim)",
                              fontSize: "0.8rem",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* Revoke / Delete actions */}
                      <td style={{ ...TD, textAlign: "right" }}>
                        {canAct && (
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => revoke(d.id)}
                              className="btn btn-secondary btn-sm"
                              disabled={saving === d.id}
                            >
                              Révoquer
                            </button>
                            <button
                              onClick={() => deleteDriver(d.id, d.name)}
                              className="btn btn-danger btn-sm"
                              disabled={saving === d.id}
                            >
                              Supprimer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {/* Refused */}
      {filter === "refused" &&
        (refused.length === 0 ? (
          <div className="card">
            <div className="empty">Aucun pilote refusé.</div>
          </div>
        ) : (
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
                {refused.map((d) => (
                  <tr key={d.id} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                    <td style={TD}>
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                    </td>
                    <td style={TD} className="mono">
                      {d.email || "—"}
                    </td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          onClick={() => approve(d.id)}
                          className="btn btn-primary btn-sm"
                          disabled={saving === d.id}
                        >
                          Approuver
                        </button>
                        <button
                          onClick={() => deleteDriver(d.id, d.name)}
                          className="btn btn-danger btn-sm"
                          disabled={saving === d.id}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

const TH = {
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

const TD = {
  padding: "0.6rem 1rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};
