"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import DriversAssignment from "./DriversAssignment";
import AvailabilityGrid from "./AvailabilityGrid";
import PerformanceData from "./PerformanceData";
import StintGrid from "./StintGrid";
import RaceMode from "./RaceMode";
import PlanningTab from "./PlanningTab";

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
  const t = useTranslations("equipageTabs");
  const isAdmin =
    currentDriver?.role === "admin" || currentDriver?.role === "super_admin";
  const isEngineer = currentDriver?.role === "engineer";
  const isExternalDriver = currentDriver?.role === "external";
  // Full access: admins and engineers can see and interact with everything
  // (engineers are read-only on non-relais tabs via the archived-style lock)
  const fullAccess = isAdmin || isEngineer;

  const TABS = [
    { id: "pilotes", label: t("tabPilotes") },
    { id: "disponibilites", label: t("tabDisponibilites") },
    { id: "relais", label: t("tabRelais") },
    { id: "planning", label: t("tabPlanning") },
    { id: "performances", label: t("tabPerformances") },
    { id: "course", label: t("tabCourse") },
  ];

  // activeStrategy — lifted from StintGrid via onActiveStrategyChange callback.
  // Avoids a redundant fetch since StintGrid already fetches all strategies.
  const [activeStrategy, setActiveStrategy] = useState(null);

  // In event but not yet in this team → only Pilotes tab visible so they can self-assign
  const limitedToAssignment = isInEvent && !isInTeam && !fullAccess;

  // Default to relais — most-used view during race preparation
  const initialTab = limitedToAssignment ? "pilotes" : "relais";
  const [activeTab, setActiveTab] = useState(initialTab);
  // Tracks which tabs have been visited — mounted once, then kept alive via
  // display:none instead of unmounting. Prevents expensive remount on every switch.
  const [mountedTabs, setMountedTabs] = useState(new Set([initialTab]));

  // When true: switches to relais tab and tells StintGrid to auto-open the recalc modal
  const [recalcRequested, setRecalcRequested] = useState(false);

  // ── Access guard ─────────────────────────────────────────────────────────
  // Neither in event nor privileged role → hard block
  if (!isInEvent && !fullAccess) {
    return (
      <div className="card">
        <div className="empty">
          <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
            {t("accessDeniedTitle")}
          </p>
          <small style={{ color: "var(--text-dim)" }}>
            {t("accessDeniedMsg")}
          </small>
        </div>
      </div>
    );
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setMountedTabs((prev) => new Set([...prev, tabId]));
  };

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
            onClick={() => handleTabChange(tab.id)}
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
          {t("archivedNotice")}
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
            {t("selfAssignHint")}
          </div>
        )}

      {/* ── Tab: Pilotes ──────────────────────────────────────────────────── */}
      {mountedTabs.has("pilotes") && (
        <div style={{ display: activeTab === "pilotes" ? "block" : "none" }}>
          <DriversAssignment
            entryId={entryId}
            entryCarId={entryCarId}
            entryCarName={entryCarName}
            entryClass={entryClass}
            carsMap={carsMap}
            startTimesMap={startTimesMap}
            assignedDrivers={assignedDrivers}
            unassignedDrivers={isExternalDriver ? [] : unassignedDrivers}
            currentDriver={currentDriver}
            archived={archived || isEngineer}
            isInEvent={isInEvent}
            isInTeam={isInTeam}
            isAdmin={isAdmin}
            teamStartTimeId={teamEntry.start_time_id}
            irlStart={teamEntry.event_start_times?.irl_start || null}
            durationMinutes={teamEntry.events?.duration_minutes || 0}
          />
        </div>
      )}

      {/* ── Tab: Disponibilités ───────────────────────────────────────────── */}
      {mountedTabs.has("disponibilites") && (
        <div
          style={{ display: activeTab === "disponibilites" ? "block" : "none" }}
        >
          <>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-dim)",
                marginBottom: "1rem",
              }}
            >
              {archived ? t("availArchivedNote") : t("availActiveNote")}
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
        </div>
      )}

      {/* ── Tab: Relais ───────────────────────────────────────────────────── */}
      {mountedTabs.has("relais") && (
        <div style={{ display: activeTab === "relais" ? "block" : "none" }}>
          <>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-dim)",
                marginBottom: "1rem",
              }}
            >
              {archived ? t("stintsArchivedNote") : t("stintsActiveNote")}
            </p>
            <StintGrid
              teamEntryId={entryId}
              teamEntry={teamEntry}
              assignedDrivers={assignedDrivers}
              currentDriver={currentDriver}
              archived={archived}
              autoOpenRecalc={recalcRequested}
              onAutoOpenHandled={() => setRecalcRequested(false)}
              onActiveStrategyChange={setActiveStrategy}
              isActive={activeTab === "relais"}
            />
          </>
        </div>
      )}

      {/* ── Tab: Planning ─────────────────────────────────────────────────── */}
      {mountedTabs.has("planning") && (
        <div style={{ display: activeTab === "planning" ? "block" : "none" }}>
          <PlanningTab
            teamEntryId={entryId}
            teamEntry={teamEntry}
            assignedDrivers={assignedDrivers}
            currentDriver={currentDriver}
            isActive={activeTab === "planning"}
          />
        </div>
      )}

      {/* ── Tab: Performances ─────────────────────────────────────────────── */}
      {mountedTabs.has("performances") && (
        <div
          style={{ display: activeTab === "performances" ? "block" : "none" }}
        >
          <>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-dim)",
                marginBottom: "1rem",
              }}
            >
              {archived ? t("perfArchivedNote") : t("perfActiveNote")}
            </p>
            <PerformanceData
              teamEntryId={entryId}
              assignedDrivers={assignedDrivers}
              archived={archived || isEngineer}
              iracingTrackId={teamEntry.events?.circuits?.iracing_track_id ?? null}
              currentDriverId={currentDriver?.id ?? null}
              entryCarName={entryCarName}
              g61Linked={!!currentDriver?.garage61_access_token}
            />
          </>
        </div>
      )}

      {/* ── Tab: Course (Race Mode) ───────────────────────────────────────────── */}
      {mountedTabs.has("course") && (
        <div style={{ display: activeTab === "course" ? "block" : "none" }}>
          <RaceMode
            teamEntryId={entryId}
            teamEntry={teamEntry}
            assignedDrivers={assignedDrivers}
            archived={archived}
            activeStrategy={activeStrategy}
            onRequestRecalc={() => {
              setRecalcRequested(true);
              handleTabChange("relais");
            }}
          />
        </div>
      )}
    </div>
  );
}
