"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser as supabase } from "../../../../../lib/supabase-browser";
import DriversAssignment from "./DriversAssignment";
import AvailabilityGrid from "./AvailabilityGrid";
import PerformanceData from "./PerformanceData";
import StintGrid from "./StintGrid";
import RaceMode from "./RaceMode";

const TABS = [
  { id: "pilotes", label: "Pilotes" },
  { id: "disponibilites", label: "Disponibilités" },
  { id: "relais", label: "Relais" },
  { id: "performances", label: "Performances" },
  { id: "course", label: "🏁 Course" },
];

export default function EquipageTabs({
  entryId,
  teamEntry,
  assignedDrivers,
  unassignedDrivers,
  entryCarId,
  entryCarName,
  entryClass,
  carsMap,
  startTimesMap,
  currentDriver,
  archived = false,
  isInEvent = false,
  isInTeam = false,
}) {
  const isAdmin =
    currentDriver?.role === "admin" || currentDriver?.role === "super_admin";
  const isEngineer = currentDriver?.role === "engineer";
  // Full access: admins and engineers can see and interact with everything
  // (engineers are read-only on non-relais tabs via the archived-style lock)
  const fullAccess = isAdmin || isEngineer;

  // activeStrategy — fetched here so RaceMode always has the current active strategy.
  // Must live before any conditional return to satisfy React hooks rules.
  const [activeStrategy, setActiveStrategy] = useState(null);

  const fetchActiveStrategy = () => {
    supabase
      .from("strategies")
      .select("*")
      .eq("team_entry_id", entryId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => setActiveStrategy(data || null));
  };

  useEffect(() => {
    if (!entryId) return;
    fetchActiveStrategy();
  }, [entryId]);

  // Realtime — refreshes activeStrategy when StintGrid changes which strategy is active
  useEffect(() => {
    if (!entryId) return;
    const channel = supabase
      .channel(`equipage-strategies-${entryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "strategies",
          filter: `team_entry_id=eq.${entryId}`,
        },
        fetchActiveStrategy,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [entryId]);

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

  // When true: switches to relais tab and tells StintGrid to auto-open the recalc modal
  const [recalcRequested, setRecalcRequested] = useState(false);

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
          entryCarName={entryCarName}
          entryClass={entryClass}
          carsMap={carsMap}
          startTimesMap={startTimesMap}
          assignedDrivers={assignedDrivers}
          unassignedDrivers={unassignedDrivers}
          currentDriver={currentDriver}
          archived={archived || isEngineer}
          isInEvent={isInEvent}
          isInTeam={isInTeam}
          isAdmin={isAdmin}
          teamStartTimeId={teamEntry.start_time_id}
          irlStart={teamEntry.event_start_times?.irl_start || null}
          durationMinutes={teamEntry.events?.duration_minutes || 0}
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
            currentDriverId={currentDriver?.id || null}
            isExternalUser={currentDriver?.role === "external"}
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
            autoOpenRecalc={recalcRequested}
            onAutoOpenHandled={() => setRecalcRequested(false)}
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

      {/* ── Tab: Course (Race Mode) ───────────────────────────────────────────── */}
      {activeTab === "course" && (
        <RaceMode
          teamEntryId={entryId}
          teamEntry={teamEntry}
          assignedDrivers={assignedDrivers}
          archived={archived}
          activeStrategy={activeStrategy}
          onRequestRecalc={() => {
            setRecalcRequested(true);
            setActiveTab("relais");
          }}
        />
      )}
    </div>
  );
}
