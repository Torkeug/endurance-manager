import Link from "next/link";
import { formatInZone } from "../../../lib/timezone";

function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export default function EngagementsTab({ sortedSignups, availMap, stintsMap }) {
  return (
    <div>
      <h2 style={{ marginBottom: "1rem" }}>
        Engagements
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 500,
            color: "var(--text-dim)",
            marginLeft: "0.75rem",
          }}
        >
          {sortedSignups.length} événement
          {sortedSignups.length !== 1 ? "s" : ""}
        </span>
      </h2>

      {sortedSignups.length === 0 ? (
        <div className="card">
          <div className="empty">
            Ce pilote n&apos;est inscrit à aucun événement.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sortedSignups.map((signup) => {
            const event = signup.events;
            const teamEntry = signup.team_entries;
            const avail = teamEntry ? availMap[teamEntry.id] : null;
            const myStints = teamEntry ? stintsMap[teamEntry.id] || [] : [];
            const startTimes = event?.event_start_times || [];
            const earliest =
              startTimes.length > 0
                ? startTimes.reduce((a, b) =>
                    a.irl_start < b.irl_start ? a : b,
                  )
                : null;

            const prefStartLabels = (signup.preferred_start_time_ids || [])
              .map((stId) => startTimes.find((st) => st.id === stId)?.label)
              .filter(Boolean);

            return (
              <div key={signup.id} className="card">
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
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                      {event?.name || "—"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-dim)",
                        marginTop: "0.2rem",
                      }}
                    >
                      {earliest
                        ? formatInZone(
                            earliest.irl_start,
                            signup.events?.timezone || "Europe/Paris",
                          )
                        : "Date à confirmer"}
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
                    Voir l&apos;événement →
                  </Link>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(200px, 1fr))",
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
                        Équipe
                      </div>
                      {teamEntry ? (
                        <>
                          <div style={{ fontWeight: 600 }}>
                            {teamEntry.crew_name}
                          </div>
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
                              {teamEntry.event_start_times.label}
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.85rem",
                          }}
                        >
                          Non assigné
                        </div>
                      )}
                    </div>
                    {teamEntry && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <Link
                          href={`/evenements/${event?.id}/equipages/${teamEntry.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Équipage →
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
                      Préférences
                    </div>
                    {(signup.preferred_class || []).length > 0 && (
                      <div
                        style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}
                      >
                        <span
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.72rem",
                          }}
                        >
                          Classes :{" "}
                        </span>
                        {signup.preferred_class.join(", ")}
                      </div>
                    )}
                    {prefStartLabels.length > 0 && (
                      <div
                        style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}
                      >
                        <span
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.72rem",
                          }}
                        >
                          Créneaux :{" "}
                        </span>
                        {prefStartLabels.join(", ")}
                      </div>
                    )}
                    {(signup.preferred_class || []).length === 0 &&
                      prefStartLabels.length === 0 && (
                        <div
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.85rem",
                          }}
                        >
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
                        Disponibilités
                      </div>
                      {avail ? (
                        <>
                          <div style={{ fontSize: "0.85rem" }}>
                            <span style={{ color: "#2eb460", fontWeight: 600 }}>
                              {avail.available}
                            </span>
                            <span style={{ color: "var(--text-dim)" }}>
                              {" "}
                              disponibles ·{" "}
                            </span>
                            <span style={{ fontWeight: 600 }}>
                              {avail.filled}
                            </span>
                            <span style={{ color: "var(--text-dim)" }}>
                              {" "}
                              renseignés
                            </span>
                          </div>
                          <div
                            style={{
                              marginTop: "0.5rem",
                              height: "6px",
                              background: "var(--border)",
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: "3px",
                                background: "var(--accent)",
                                width: `${Math.min(
                                  100,
                                  (avail.available /
                                    Math.max(1, avail.filled)) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.85rem",
                          }}
                        >
                          Non renseignée
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
                          Relais assignés
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
                                  Relais #{stint.stint_number}
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
                          <div
                            style={{
                              color: "var(--text-dim)",
                              fontSize: "0.85rem",
                            }}
                          >
                            Aucun relais assigné
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: "0.75rem" }}>
                        <Link
                          href={`/evenements/${event?.id}/equipages/${teamEntry.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Voir les relais →
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
                      Notes :{" "}
                    </span>
                    {signup.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
