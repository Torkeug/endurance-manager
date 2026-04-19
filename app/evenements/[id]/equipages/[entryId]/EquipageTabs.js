"use client";
import { useState } from "react";
import DriversAssignment from "./DriversAssignment";
import AvailabilityGrid from "./AvailabilityGrid";
import PerformanceData from "./PerformanceData";
import StintGrid from "./StintGrid";

const TABS = [
  { id: "pilotes", label: "Pilotes" },
  { id: "disponibilites", label: "Disponibilités" },
  { id: "relais", label: "Relais" },
  { id: "performances", label: "Performances" },
];

export default function EquipageTabs({
  entryId,
  teamEntry,
  assignedDrivers,
  unassignedDrivers,
  entryCarId,
  entryClass,
  currentDriver,
  // archived flows from the parent event — locks all tabs to read-only
  archived = false,
  // isInEvent: the current driver has at least one signup for this event
  isInEvent = false,
  // isInTeam: the current driver is assigned to this specific team entry
  isInTeam = false,
}) {
  const isAdmin =
    currentDriver?.role === "admin" || currentDriver?.role === "super_admin";
  const isEngineer = currentDriver?.role === "engineer";
  // Full access: admins and engineers can see and interact with everything
  // (engineers are read-only on non-relais tabs via the archived-style lock)
  const fullAccess = isAdmin || isEngineer;

  // ── Access guard ─────────────────────────────────────────────────────────
  // Neither in event nor privileged role → hard block
  if (!isInEvent && !fullAccess) {
    return (
      <div className="card">
        <div className="empty">
          <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
            Accès limité
          </p>
          <small style={{ color: "var(--text-dim)" }}>
            Vous devez être inscrit à cet événement pour voir cet équipage.
          </small>
        </div>
      </div>
    );
  }

  // In event but not yet in this team → only Pilotes tab visible so they can self-assign
  const limitedToAssignment = isInEvent && !isInTeam && !fullAccess;

  // Default to relais — most-used view during race preparation
  const [activeTab, setActiveTab] = useState(
    limitedToAssignment ? "pilotes" : "relais",
  );

  const visibleTabs = limitedToAssignment
    ? TABS.filter((t) => t.id === "pilotes")
    : TABS;

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "0.6rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Archived notice */}
      {archived && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.65rem 0.9rem",
            background: "rgba(224,85,85,0.08)",
            border: "1px solid var(--danger)",
            borderRadius: "3px",
            fontSize: "0.82rem",
            color: "var(--danger)",
          }}
        >
          📦 Cet événement est archivé — toutes les données sont en lecture
          seule.
        </div>
      )}

      {/* Self-assign hint — shown when driver is in event but not yet in this team */}
      {limitedToAssignment &&
        !archived &&
        unassignedDrivers.some((s) => s.drivers?.id === currentDriver?.id) && (
          <div
            style={{
              marginBottom: "1.25rem",
              padding: "0.65rem 0.9rem",
              background: "rgba(var(--accent-rgb),0.08)",
              border: "1px solid var(--accent)",
              borderRadius: "3px",
              fontSize: "0.82rem",
              color: "var(--accent)",
            }}
          >
            💡 Rejoignez cet équipage via le tableau ci-dessous pour accéder aux
            autres onglets.
          </div>
        )}

      {/* ── Tab: Pilotes ──────────────────────────────────────────────────── */}
      {activeTab === "pilotes" && (
        <DriversAssignment
          entryId={entryId}
          entryCarId={entryCarId}
          entryClass={entryClass}
          assignedDrivers={assignedDrivers}
          unassignedDrivers={unassignedDrivers}
          currentDriver={currentDriver}
          // Engineers are read-only on this tab
          archived={archived || isEngineer}
          isInEvent={isInEvent}
          isInTeam={isInTeam}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Tab: Disponibilités ───────────────────────────────────────────── */}
      {activeTab === "disponibilites" && (
        <>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-dim)",
              marginBottom: "1rem",
            }}
          >
            {archived
              ? "Disponibilités enregistrées au moment de l'archivage."
              : "Sélectionnez votre nom et cliquez ou glissez sur les créneaux pour marquer votre disponibilité."}
          </p>
          <AvailabilityGrid
            teamEntryId={entryId}
            assignedDrivers={assignedDrivers}
            irlStart={teamEntry.event_start_times?.irl_start || null}
            durationMinutes={teamEntry.events?.duration_minutes || 0}
            igStartTime={teamEntry.events?.ig_start_time || null}
            igSunrise={teamEntry.events?.ig_sunrise || null}
            igSunset={teamEntry.events?.ig_sunset || null}
            archived={archived || isEngineer}
          />
        </>
      )}

      {/* ── Tab: Relais ───────────────────────────────────────────────────── */}
      {activeTab === "relais" && (
        <>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-dim)",
              marginBottom: "1rem",
            }}
          >
            {archived
              ? "Relais planifiés au moment de l'archivage."
              : "Les temps IRL et IG sont calculés automatiquement. Les points colorés indiquent la disponibilité de chaque pilote."}
          </p>
          <StintGrid
            teamEntryId={entryId}
            teamEntry={teamEntry}
            assignedDrivers={assignedDrivers}
            archived={archived}
          />
        </>
      )}

      {/* ── Tab: Performances ─────────────────────────────────────────────── */}
      {activeTab === "performances" && (
        <>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-dim)",
              marginBottom: "1rem",
            }}
          >
            {archived
              ? "Données de performance enregistrées au moment de l'archivage."
              : "Chronos et consommations relevés lors des essais. Cliquez sur Modifier pour renseigner vos données."}
          </p>
          <PerformanceData
            teamEntryId={entryId}
            assignedDrivers={assignedDrivers}
            archived={archived || isEngineer}
          />
        </>
      )}
    </div>
  );
}
