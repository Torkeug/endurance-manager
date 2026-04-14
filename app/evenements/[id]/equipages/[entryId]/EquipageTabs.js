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
  // archived flows from the parent event — passed to every tab so they
  // can all switch to read-only mode without separate DB queries
  archived = false,
}) {
  // Default to the relais tab — it's the most-used view during race preparation.
  const [activeTab, setActiveTab] = useState("relais");

  const tabBar = (
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
      {TABS.map((tab) => (
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
  );

  return (
    <div>
      {tabBar}

      {/* Read-only notice shown across all tabs when the event is archived */}
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

      {activeTab === "pilotes" && (
        <DriversAssignment
          entryId={entryId}
          entryCarId={entryCarId}
          entryClass={entryClass}
          assignedDrivers={assignedDrivers}
          unassignedDrivers={unassignedDrivers}
          currentDriver={currentDriver}
          archived={archived}
        />
      )}

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
            archived={archived}
          />
        </>
      )}

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
            archived={archived}
          />
        </>
      )}
    </div>
  );
}
