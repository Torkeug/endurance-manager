"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

const emptyForm = { name: "", pit_lane_time_seconds: "" };

function ConfirmModal({ modal, onConfirm, onCancel }) {
  const t = useTranslations("admin");
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
        <h3 style={{ marginBottom: "0.75rem" }}>{modal.title}</h3>

        {modal.activeEvents?.length > 0 && (
          <>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-dim)",
                marginBottom: "0.75rem",
              }}
            >
              {t("circuitsActiveWarningIntro")}{" "}
              <strong style={{ color: "var(--text)" }}>
                {t("circuitsActiveCount", { count: modal.activeEvents.length })}
              </strong>{" "}
              {t("circuitsActiveSuffix")}
            </p>
            <ul
              style={{
                margin: "0 0 0.75rem",
                paddingLeft: "1.25rem",
                fontSize: "0.88rem",
                color: "var(--danger)",
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              {modal.activeEvents.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </>
        )}

        {modal.archivedCount > 0 && (
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--text-dim)",
              marginBottom: "0.75rem",
            }}
          >
            {t("circuitsArchivedNote", { count: modal.archivedCount })}
          </p>
        )}

        {!modal.activeEvents?.length && !modal.archivedCount && (
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text-dim)",
              marginBottom: "1rem",
            }}
          >
            {modal.message || t("circuitsNoEvents")}
          </p>
        )}

        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          {t("irreversible")}
        </p>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button onClick={onConfirm} className="btn btn-danger">
            {modal.confirmLabel || t("confirm")}
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CircuitsManager({ initialCircuits, iracingTracks }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [circuits, setCircuits] = useState(initialCircuits);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedIracingTrack, setSelectedIracingTrack] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Collapsed groups state — persisted in localStorage, all collapsed by default
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [groupStateLoaded, setGroupStateLoaded] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Group iRacing tracks by base track name for the dropdown
  const groupedTracks = useMemo(() => {
    const groups = {};
    for (const track of iracingTracks || []) {
      if (!groups[track.track_name]) groups[track.track_name] = [];
      groups[track.track_name].push(track);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [iracingTracks]);

  // Build a map of iracing_track_id → track_name for display grouping
  const trackNameById = useMemo(() => {
    const map = {};
    for (const tr of iracingTracks || []) map[tr.iracing_track_id] = tr.track_name;
    return map;
  }, [iracingTracks]);

  // Group Kronos circuits by iRacing base track name for collapsible display
  const circuitGroups = useMemo(() => {
    const groups = {};
    const unlinked = [];
    for (const c of circuits) {
      if (c.iracing_track_id && trackNameById[c.iracing_track_id]) {
        const name = trackNameById[c.iracing_track_id];
        if (!groups[name]) groups[name] = [];
        groups[name].push(c);
      } else {
        unlinked.push(c);
      }
    }
    return {
      sorted: Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)),
      unlinked,
    };
  }, [circuits, trackNameById]);

  // Load expanded groups from localStorage after mount — intentional two-setState
  // pattern for hydration safety; setGroupStateLoaded gates the persist effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kronos_circuits_expanded");
      if (saved) setExpandedGroups(new Set(JSON.parse(saved)));
    } catch {}
    setGroupStateLoaded(true);
  }, []);

  // Persist expanded groups to localStorage
  useEffect(() => {
    if (!groupStateLoaded) return;
    try {
      localStorage.setItem(
        "kronos_circuits_expanded",
        JSON.stringify([...expandedGroups]),
      );
    } catch {}
  }, [expandedGroups, groupStateLoaded]);

  const toggleGroup = (key) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Filter grouped tracks by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim() || selectedIracingTrack) return [];
    const q = searchQuery.toLowerCase();
    return groupedTracks
      .map(([trackName, configs]) => ({
        trackName,
        configs: configs.filter(
          (c) =>
            trackName.toLowerCase().includes(q) ||
            (c.config_name || "").toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.configs.length > 0)
      .slice(0, 15);
  }, [searchQuery, groupedTracks, selectedIracingTrack]);

  // Display label for a track config in the dropdown
  const trackDisplayName = (track) =>
    track.config_name
      ? `${track.track_name} — ${track.config_name}`
      : track.track_name;

  const selectIracingTrack = (track) => {
    setSelectedIracingTrack(track);
    setSearchQuery(trackDisplayName(track));
    // Auto-fill name — editable by admin
    setForm((prev) => ({
      ...prev,
      name: prev.name || trackDisplayName(track),
    }));
  };

  const clearIracingTrackSelection = () => {
    setSelectedIracingTrack(null);
    setSearchQuery("");
  };

  const validate = () => {
    if (!form.name.trim()) {
      setError(t("errorNameRequired"));
      return false;
    }
    return true;
  };

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setSelectedIracingTrack(null);
    setSearchQuery("");
    setForm(emptyForm);
    setError(null);
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from("circuits")
      .insert([
        {
          name: form.name.trim(),
          pit_lane_time_seconds: form.pit_lane_time_seconds
            ? parseInt(form.pit_lane_time_seconds)
            : null,
          iracing_track_id: selectedIracingTrack?.iracing_track_id || null,
        },
      ])
      .select()
      .single();
    if (err) {
      setError(err.code === "23505" ? "Ce nom existe déjà." : err.message);
      setSaving(false);
      return;
    }
    setCircuits((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
    );
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleEdit = async () => {
    if (!validate()) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from("circuits")
      .update({
        name: form.name.trim(),
        pit_lane_time_seconds: form.pit_lane_time_seconds
          ? parseInt(form.pit_lane_time_seconds)
          : null,
        iracing_track_id: selectedIracingTrack?.iracing_track_id || null,
      })
      .eq("id", editingId)
      .select()
      .single();
    if (err) {
      setError(err.code === "23505" ? "Ce nom existe déjà." : err.message);
      setSaving(false);
      return;
    }
    setCircuits((prev) => prev.map((c) => (c.id === editingId ? data : c)));
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id) => {
    const { data: affectedEventsData } = await supabase
      .from("events")
      .select("name, archived")
      .eq("circuit_id", id);

    const activeEvents = (affectedEventsData || [])
      .filter((e) => !e.archived)
      .map((e) => e.name);

    const archivedCount = (affectedEventsData || []).filter(
      (e) => e.archived,
    ).length;

    setConfirmModal({
      title: t("circuitsDeleteTitle"),
      activeEvents,
      archivedCount,
      confirmLabel: t("delete"),
      onConfirm: async () => {
        setConfirmModal(null);
        const { error: err } = await supabase
          .from("circuits")
          .delete()
          .eq("id", id);
        if (err) {
          setError(err.message);
          return;
        }
        setCircuits((prev) => prev.filter((c) => c.id !== id));
        router.refresh();
      },
    });
  };

  const startEdit = (circuit) => {
    setEditingId(circuit.id);
    setForm({
      name: circuit.name,
      pit_lane_time_seconds: circuit.pit_lane_time_seconds
        ? String(circuit.pit_lane_time_seconds)
        : "",
    });
    // Pre-load iRacing track if linked
    if (circuit.iracing_track_id) {
      const track = (iracingTracks || []).find(
        (tr) => tr.iracing_track_id === circuit.iracing_track_id,
      );
      if (track) {
        setSelectedIracingTrack(track);
        setSearchQuery(trackDisplayName(track));
      }
    }
    setAdding(false);
    setError(null);
  };

  const editForm = (
    <div style={{ padding: "1rem", background: "var(--surface-2)" }}>
      {/* iRacing catalog search */}
      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label>
          {t("circuitsIracingLabel")}{" "}
          <span style={{ fontWeight: 400, color: "var(--text-dim)" }}>
            {t("circuitsIracingOptional")}
          </span>
        </label>
        {!iracingTracks?.length ? (
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-dim)",
              padding: "0.5rem 0",
            }}
          >
            {t("circuitsIracingEmpty")}
          </div>
        ) : selectedIracingTrack ? (
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              {trackDisplayName(selectedIracingTrack)}
            </span>
            <button
              type="button"
              onClick={clearIracingTrackSelection}
              className="btn btn-secondary btn-sm"
            >
              {t("change")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedIracingTrack(null);
                setSearchQuery("");
              }}
              className="btn btn-danger btn-sm"
            >
              {t("circuitsUnlink")}
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchQuery("");
              }}
              placeholder={t("circuitsIracingSearch")}
            />
            {filteredGroups.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  zIndex: 10,
                  maxHeight: "300px",
                  overflowY: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}
              >
                {filteredGroups.map(({ trackName, configs }) => (
                  <div key={trackName}>
                    {/* Base track name header */}
                    <div
                      style={{
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-dim)",
                        background: "var(--surface-2)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {trackName}
                    </div>
                    {/* Config options */}
                    {configs.map((track) => (
                      <div
                        key={track.iracing_track_id}
                        onClick={() => selectIracingTrack(track)}
                        style={{
                          padding: "0.45rem 0.75rem 0.45rem 1.5rem",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          borderBottom: "1px solid var(--border)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--surface-2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {track.config_name || t("circuitsFullLayout")}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Circuit name — auto-filled from iRacing but editable */}
      <div className="form-grid" style={{ marginBottom: "1rem" }}>
        <div className="form-group">
          <label>{t("circuitsNameLabel")}</label>
          <input
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder={t("circuitsNamePlaceholder")}
          />
        </div>
        <div className="form-group">
          <label>
            {t("circuitsPitLabel")}{" "}
            <span style={{ fontWeight: 400, color: "var(--text-dim)" }}>
              {t("circuitsPitOptional")}
            </span>
          </label>
          <input
            type="number"
            value={form.pit_lane_time_seconds}
            onChange={set("pit_lane_time_seconds")}
            placeholder={t("circuitsPitPlaceholder")}
            min="1"
            max="300"
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={editingId ? handleEdit : handleAdd}
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? t("saving") : editingId ? t("save") : t("add")}
        </button>
        <button onClick={reset} className="btn btn-secondary">
          {t("cancel")}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      {!adding && !editingId && error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {adding && (
        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "var(--text-dim)" }}>
            {t("circuitsNewTitle")}
          </h3>
          {editForm}
        </div>
      )}

      {!adding && !editingId && (
        <button
          onClick={() => setAdding(true)}
          className="btn btn-primary"
          style={{ marginBottom: "0.75rem" }}
        >
          {t("circuitsAddBtn")}
        </button>
      )}

      <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-dim)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "0.6rem 1rem",
                  textAlign: "left",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {t("circuitsColCircuit")}
              </th>
              <th
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-dim)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "0.6rem 1rem",
                  textAlign: "left",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {t("circuitsColPitLane")}
              </th>
              <th
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              />
            </tr>
          </thead>
          <tbody>
            {/* Linked circuits grouped by base track name — collapsible */}
            {circuitGroups.sorted.map(([trackName, configs]) => {
              const isExpanded = expandedGroups.has(trackName);
              return (
                <React.Fragment key={trackName}>
                  {/* Group header — clickable to expand/collapse */}
                  <tr
                    onClick={() => toggleGroup(trackName)}
                    style={{ cursor: "pointer" }}
                  >
                    <td
                      colSpan={3}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "var(--surface-2)",
                        borderBottom: "1px solid var(--border)",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        userSelect: "none",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          marginRight: "0.5rem",
                          fontSize: "0.6rem",
                          color: "var(--text-dim)",
                          transition: "transform 0.15s",
                          transform: isExpanded
                            ? "rotate(90deg)"
                            : "rotate(0deg)",
                        }}
                      >
                        ▶
                      </span>
                      {trackName}
                      <span
                        style={{
                          marginLeft: "0.6rem",
                          fontSize: "0.75rem",
                          fontWeight: 400,
                          color: "var(--accent)",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {configs.length}
                      </span>
                    </td>
                  </tr>

                  {/* Circuit rows — shown when expanded */}
                  {isExpanded &&
                    configs.map((circuit) => (
                      <React.Fragment key={circuit.id}>
                        <tr>
                          <td
                            style={{ fontWeight: 600, paddingLeft: "2.5rem" }}
                          >
                            {circuit.name}
                          </td>
                          <td
                            className="mono"
                            style={{ color: "var(--accent)" }}
                          >
                            {circuit.pit_lane_time_seconds
                              ? `${circuit.pit_lane_time_seconds}s`
                              : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                onClick={() => startEdit(circuit)}
                                className="btn btn-secondary btn-sm"
                              >
                                {t("edit")}
                              </button>
                              <button
                                onClick={() => handleDelete(circuit.id)}
                                className="btn btn-danger btn-sm"
                              >
                                {t("delete")}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingId === circuit.id && (
                          <tr>
                            <td colSpan={3}>{editForm}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                </React.Fragment>
              );
            })}

            {/* Unlinked circuits — not grouped, shown in "Autres" collapsible */}
            {circuitGroups.unlinked.length > 0 && (
              <React.Fragment key="__autres__">
                <tr
                  onClick={() => toggleGroup("__autres__")}
                  style={{ cursor: "pointer" }}
                >
                  <td
                    colSpan={3}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      color: "var(--text-dim)",
                      fontStyle: "italic",
                      userSelect: "none",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        marginRight: "0.5rem",
                        fontSize: "0.6rem",
                        transition: "transform 0.15s",
                        transform: expandedGroups.has("__autres__")
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      ▶
                    </span>
                    {t("circuitsOthers")}
                    <span
                      style={{
                        marginLeft: "0.6rem",
                        fontSize: "0.75rem",
                        fontWeight: 400,
                        color: "var(--accent)",
                        fontFamily: "var(--font-mono), monospace",
                      }}
                    >
                      {circuitGroups.unlinked.length}
                    </span>
                  </td>
                </tr>
                {expandedGroups.has("__autres__") &&
                  circuitGroups.unlinked.map((circuit) => (
                    <React.Fragment key={circuit.id}>
                      <tr>
                        <td style={{ fontWeight: 600, paddingLeft: "2.5rem" }}>
                          {circuit.name}
                        </td>
                        <td className="mono" style={{ color: "var(--accent)" }}>
                          {circuit.pit_lane_time_seconds
                            ? `${circuit.pit_lane_time_seconds}s`
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => startEdit(circuit)}
                              className="btn btn-secondary btn-sm"
                            >
                              {t("edit")}
                            </button>
                            <button
                              onClick={() => handleDelete(circuit.id)}
                              className="btn btn-danger btn-sm"
                            >
                              {t("delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editingId === circuit.id && (
                        <tr>
                          <td colSpan={3}>{editForm}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            )}

            {circuits.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  {t("circuitsEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
