"use client";
import { useState } from "react";
import Link from "next/link";
import { formatInZone, formatDateLabelInZone } from "../../../lib/timezone";
import { useTranslations, useLocale } from "next-intl";

function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// A signup's event is "past" if all its start times are in the past,
// or if the event is archived.
function isEventPast(signup) {
  if (signup.events?.archived) return true;
  const startTimes = signup.events?.event_start_times || [];
  if (startTimes.length === 0) return false;
  const now = new Date();
  return startTimes.every((st) => new Date(st.irl_start) < now);
}

// ── Signup card ───────────────────────────────────────────────────────────────
function SignupCard({ signup, availMap, stintsMap, carsMap = {} }) {
  const t = useTranslations("driverEngagements");
  const locale = useLocale();
  const event = signup.events;
  const teamEntry = signup.team_entries;
  const avail = teamEntry ? availMap[teamEntry.id] : null;
  const myStints = teamEntry ? stintsMap[teamEntry.id] || [] : [];
  const startTimes = event?.event_start_times || [];
  const earliest =
    startTimes.length > 0
      ? startTimes.reduce((a, b) => (a.irl_start < b.irl_start ? a : b)) // ISO string comparison is lexicographic — valid because irl_start is UTC
      : null;

  const tz = event?.timezone || "Europe/Paris";
  const prefStartLabels = (signup.preferred_start_time_ids || [])
    .map((stId) => {
      const st = startTimes.find((s) => s.id === stId);
      return st ? formatDateLabelInZone(st.irl_start, tz, locale) : null;
    })
    .filter(Boolean);

  return (
    <div className="card">
      {/* Event header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "0.2rem",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>
              {event?.name || "—"}
            </span>
            {/* Archived badge — mirrors event detail page style */}
            {event?.archived && (
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "0.1rem 0.4rem",
                  background: "rgba(224,85,85,0.1)",
                  border: "1px solid var(--danger)",
                  borderRadius: "3px",
                  color: "var(--danger)",
                }}
              >
                {t("badgeArchived")}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-dim)",
            }}
          >
            {earliest
              ? formatInZone(
                  earliest.irl_start,
                  signup.events?.timezone || "Europe/Paris",
                )
              : t("dateUnknown")}
            {event?.circuits?.name && ` · ${event.circuits.name}`}
            {event?.format && ` · ${event.format}`}
            {event?.duration_minutes &&
              ` · ${formatDuration(event.duration_minutes)}`}
          </div>
        </div>
        <Link
          href={`/evenements/${event?.id}`}
          className="btn btn-secondary btn-sm"
        >
          {t("viewEvent")}
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {/* Team */}
        <div
          style={{
            background: "var(--surface-2)",
            borderRadius: "3px",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: "0.35rem",
              }}
            >
              {t("sectionTeam")}
            </div>
            {teamEntry ? (
              <>
                <div style={{ fontWeight: 600 }}>{teamEntry.crew_name}</div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-dim)",
                    marginTop: "0.1rem",
                  }}
                >
                  {teamEntry.cars?.name || "—"}
                  {teamEntry.class && ` · ${teamEntry.class}`}
                </div>
                {teamEntry.event_start_times && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--accent)",
                      marginTop: "0.2rem",
                    }}
                  >
                    {formatDateLabelInZone(teamEntry.event_start_times.irl_start, tz, locale)}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                {t("noTeam")}
              </div>
            )}
          </div>
          {teamEntry && (
            <div style={{ marginTop: "0.75rem" }}>
              <Link
                href={`/evenements/${event?.id}/equipages/${teamEntry.id}`}
                className="btn btn-primary btn-sm"
              >
                {t("viewEntry")}
              </Link>
            </div>
          )}
        </div>

        {/* Preferences */}
        <div
          style={{
            background: "var(--surface-2)",
            borderRadius: "3px",
            padding: "0.75rem",
          }}
        >
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              marginBottom: "0.35rem",
            }}
          >
            {t("sectionPrefs")}
          </div>
          {(signup.preferred_class || []).length > 0 && (
            <div style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>
                {t("prefClasses")}{" "}
              </span>
              {signup.preferred_class.join(", ")}
            </div>
          )}
          {/* Resolve preferred car IDs to names — for archived events use snapshot */}
          {(() => {
            const carNames =
              signup.events?.archived &&
              signup.preferred_car_names_snapshot?.length > 0
                ? signup.preferred_car_names_snapshot
                : (signup.preferred_car_ids || [])
                    .map((id) => carsMap[id])
                    .filter(Boolean);
            if (carNames.length === 0) return null;
            return (
              <div style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}>
                <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>
                  {t("prefCars")}{" "}
                </span>
                {carNames.join(", ")}
              </div>
            );
          })()}
          {prefStartLabels.length > 0 && (
            <div style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>
                {t("prefSlots")}{" "}
              </span>
              {prefStartLabels.join(", ")}
            </div>
          )}
          {(signup.preferred_class || []).length === 0 &&
            (signup.preferred_car_ids || []).length === 0 &&
            prefStartLabels.length === 0 && (
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                —
              </div>
            )}
        </div>

        {/* Availability */}
        {teamEntry && (
          <div
            style={{
              background: "var(--surface-2)",
              borderRadius: "3px",
              padding: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: "0.35rem",
              }}
            >
              {t("sectionAvail")}
            </div>
            {avail ? (
              <>
                <div style={{ fontSize: "0.85rem" }}>
                  <span style={{ color: "#2eb460", fontWeight: 600 }}>
                    {avail.available}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}> {t("availSlotsUnit")}</span>
                  {avail.tentative > 0 && (
                    <>
                      <span style={{ color: "var(--text-dim)" }}> · </span>
                      <span style={{ color: "#d4904a", fontWeight: 600 }}>
                        {avail.tentative}
                      </span>
                      <span style={{ color: "var(--text-dim)" }}>
                        {" "}{t("availTentativeUnit")}
                      </span>
                    </>
                  )}
                  <span style={{ color: "var(--text-dim)" }}> · </span>
                  <span style={{ fontWeight: 600 }}>{avail.filled}</span>
                  <span style={{ color: "var(--text-dim)" }}> {t("availFilledUnit")}</span>
                </div>
                {/* Bar: green = available, amber = tentative, rest = unavailable */}
                <div
                  style={{
                    marginTop: "0.5rem",
                    height: "6px",
                    background: "var(--border)",
                    borderRadius: "3px",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--accent)",
                      width: `${Math.min(
                        100,
                        (avail.available / Math.max(1, avail.filled)) * 100, // Math.max(1, …) prevents division by zero
                      )}%`,
                      transition: "width 0.3s",
                    }}
                  />
                  {avail.tentative > 0 && (
                    <div
                      style={{
                        height: "100%",
                        background: "#d4904a",
                        width: `${Math.min(
                          100,
                          (avail.tentative / Math.max(1, avail.filled)) * 100, // Math.max(1, …) prevents division by zero
                        )}%`,
                        transition: "width 0.3s",
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                {t("availNone")}
              </div>
            )}
          </div>
        )}

        {/* Stints */}
        {teamEntry && (
          <div
            style={{
              background: "var(--surface-2)",
              borderRadius: "3px",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: "0.35rem",
                }}
              >
                {t("sectionStints")}
              </div>
              {myStints.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  {myStints.map((stint) => (
                    <div
                      key={stint.id}
                      className="mono"
                      style={{
                        fontSize: "0.78rem",
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "var(--accent)" }}>
                        {t("stintLabel", { number: stint.stint_number })}
                      </span>
                      {stint.irl_start && (
                        <span style={{ color: "var(--text-dim)" }}>
                          {formatInZone(
                            stint.irl_start,
                            stint.team_entries?.events?.timezone ||
                              "Europe/Paris",
                          )}
                        </span>
                      )}
                      {stint.rain && <span>💧</span>}
                      {stint.tyre_change && <span>🛞</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                  {t("noStints")}
                </div>
              )}
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Link
                href={`/evenements/${event?.id}/equipages/${teamEntry.id}`}
                className="btn btn-primary btn-sm"
              >
                {t("viewStints")}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {signup.notes && (
        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.82rem",
            color: "var(--text-dim)",
            borderTop: "1px solid var(--border)",
            paddingTop: "0.75rem",
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--text)" }}>
            {t("notesLabel")}{" "}
          </span>
          {signup.notes}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function EngagementsTab({
  sortedSignups,
  availMap,
  stintsMap,
  carsMap = {},
}) {
  const t = useTranslations("driverEngagements");
  const upcoming = sortedSignups.filter((s) => !isEventPast(s));
  const past = sortedSignups.filter((s) => isEventPast(s));

  // Past events collapsed by default — driver profile focuses on upcoming
  const [showPast, setShowPast] = useState(false);

  return (
    <div>
      <h2 style={{ marginBottom: "1rem" }}>
        {t("title")}
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 500,
            color: "var(--text-dim)",
            marginLeft: "0.75rem",
          }}
        >
          {t("eventCount", { count: sortedSignups.length })}
        </span>
      </h2>

      {sortedSignups.length === 0 ? (
        <div className="card">
          <div className="empty">{t("empty")}</div>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {/* ── Upcoming ─────────────────────────────────────────────── */}
          {upcoming.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  marginBottom: "0.75rem",
                }}
              >
                {t("upcoming", { count: upcoming.length })}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {upcoming.map((signup) => (
                  <SignupCard
                    key={signup.id}
                    signup={signup}
                    availMap={availMap}
                    stintsMap={stintsMap}
                    carsMap={carsMap}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Past ─────────────────────────────────────────────────── */}
          {past.length > 0 && (
            <div>
              <button
                onClick={() => setShowPast((p) => !p)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--text-dim)",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: 0,
                  marginBottom: showPast ? "0.75rem" : 0,
                }}
              >
                <span>{showPast ? "▲" : "▼"}</span>
                {t("past", { count: past.length })}
              </button>
              {showPast && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    opacity: 0.8,
                  }}
                >
                  {past.map((signup) => (
                    <SignupCard
                      key={signup.id}
                      signup={signup}
                      availMap={availMap}
                      stintsMap={stintsMap}
                      carsMap={carsMap}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edge case: all events are upcoming, none past */}
          {upcoming.length === 0 && past.length === 0 && (
            <div className="card">
              <div className="empty">{t("empty")}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
