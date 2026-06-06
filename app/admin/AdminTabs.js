"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import EquipagesManager from "./EquipagesManager";
import CarsManager from "./CarsManager";
import ClassesManager from "./ClassesManager";
import CircuitsManager from "./CircuitsManager";
import EventTypesManager from "./EventTypesManager";
import DriversManager from "./DriversManager";
import SettingsManager from "./SettingsManager";
import Garage61Manager from "./Garage61Manager";

export default function AdminTabs({
  circuits,
  cars,
  crewNames,
  carClasses,
  eventTypes,
  eventTypeCars,
  drivers,
  currentDriver,
  settings,
  durationPresets,
  specialStartTimes,
  signupTags,
  iracingCars,
  iracingTracks,
}) {
  const t = useTranslations("admin");
  const TABS = [
    { id: "pilotes", label: t("tabDrivers") },
    { id: "equipages", label: t("tabEntries") },
    { id: "voitures", label: t("tabCars") },
    { id: "classes", label: t("tabClasses") },
    { id: "circuits", label: t("tabCircuits") },
    { id: "types", label: t("tabEventTypes") },
    { id: "garage61", label: t("tabGarage61") },
    { id: "parametres", label: t("tabSettings") },
  ];
  const [activeTab, setActiveTab] = useState("pilotes");
  // Count drivers awaiting approval for the red badge on the Pilotes tab
  const pendingCount = (drivers || []).filter(
    (d) => !d.approved && !d.refused,
  ).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          // Hide scrollbar visually while keeping horizontal scroll on mobile
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
              whiteSpace: "nowrap", // prevents label text from wrapping
              flexShrink: 0, // prevents button from collapsing in flex container
            }}
          >
            {tab.label}
            {tab.id === "pilotes" && pendingCount > 0 && (
              <span
                style={{
                  marginLeft: "0.4rem",
                  background: "var(--danger)",
                  color: "#fff",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: "10px",
                  verticalAlign: "middle",
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "pilotes" && (
        <DriversManager
          initialDrivers={drivers || []}
          currentDriver={currentDriver}
        />
      )}
      {activeTab === "equipages" && (
        <EquipagesManager initialCrewNames={crewNames} />
      )}
      {activeTab === "voitures" && (
        <CarsManager initialCars={cars} iracingCars={iracingCars} />
      )}
      {activeTab === "classes" && (
        <ClassesManager initialClasses={carClasses} initialCars={cars} />
      )}
      {activeTab === "circuits" && (
        <CircuitsManager
          initialCircuits={circuits}
          iracingTracks={iracingTracks}
        />
      )}
      {activeTab === "types" && (
        <EventTypesManager
          initialEventTypes={eventTypes}
          initialEventTypeCars={eventTypeCars}
          cars={cars}
          carClasses={carClasses}
        />
      )}
      {activeTab === "garage61" && (
        <Garage61Manager currentDriver={currentDriver} />
      )}
      {activeTab === "parametres" && (
        <SettingsManager
          initialPresets={durationPresets}
          initialDefaultDuration={parseInt(
            settings?.default_event_duration_minutes || "160",
          )}
          initialSpecialStartTimes={specialStartTimes}
          initialSignupTags={signupTags}
        />
      )}
    </div>
  );
}
