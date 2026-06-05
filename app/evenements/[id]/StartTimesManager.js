"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../lib/supabase-browser";
import {
  localToUTC,
  utcToInputValues,
  formatTimeInZone,
  formatDateLabelInZone,
} from "../../../lib/timezone";
import { useTranslations, useLocale } from "next-intl";

function ConfirmModal({ modal, onConfirm, onCancel }) {
  const t = useTranslations("eventForm");
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
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>{modal.title}</h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
          }}
        >
          {modal.message}
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


export default function StartTimesManager({
  eventId,
  initialStartTimes,
  timezone = "Europe/Paris",
  isSpecial,
  isAdmin,
  archived = false,
}) {
  const t = useTranslations("eventForm");
  const locale = useLocale();
  const router = useRouter();
  const [startTimes, setStartTimes] = useState(initialStartTimes);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const resetForm = () => {
    setAdding(false);
    setEditingId(null);
    setDate("");
    setTime("");
    setError(null);
  };

  // Convert stored UTC time back to local date/time inputs in the event timezone
  // so the edit form shows the correct local values, not UTC.
  const startEdit = (st) => {
    const { date: d, time: t } = utcToInputValues(st.irl_start, timezone);
    setEditingId(st.id);
    setDate(d);
    setTime(t);
    setAdding(false);
    setError(null);
  };

  const handleAdd = async () => {
    if (!date) {
      setError(t("errorDate"));
      return;
    }
    if (!time) {
      setError(t("errorTime"));
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("event_start_times")
      .insert([
        {
          event_id: eventId,
          label: formatDateLabelInZone(localToUTC(date, time, timezone), timezone, locale),
          irl_start: localToUTC(date, time, timezone),
        },
      ])
      .select()
      .single();
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    setStartTimes((prev) => [...prev, data]);
    resetForm();
    setSaving(false);
    router.refresh();
  };

  const handleSaveEdit = async () => {
    if (!date) {
      setError(t("errorDate"));
      return;
    }
    if (!time) {
      setError(t("errorTime"));
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("event_start_times")
      .update({
        label: formatDateLabelInZone(localToUTC(date, time, timezone), timezone, locale),
        irl_start: localToUTC(date, time, timezone),
      })
      .eq("id", editingId)
      .select()
      .single();
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    setStartTimes((prev) => prev.map((s) => (s.id === editingId ? data : s)));
    resetForm();
    setSaving(false);
    router.refresh();
  };

  const handleDelete = (stId) => {
    setConfirmModal({
      title: t("slotDeleteTitle"),
      message: t("slotDeleteMsg"),
      confirmLabel: t("slotDeleteConfirm"),
      onConfirm: async () => {
        const { error: err } = await supabase
          .from("event_start_times")
          .delete()
          .eq("id", stId);

        if (err) {
          if (err.code === "23503") {
            setError(t("slotInUse"));
          } else {
            setError(err.message);
          }
          return;
        }

        setConfirmModal(null);
        setStartTimes((prev) => prev.filter((s) => s.id !== stId));

        if (editingId === stId) resetForm();

        router.refresh();
      },
    });
  };

  const sorted = [...startTimes].sort(
    (a, b) => new Date(a.irl_start) - new Date(b.irl_start),
  );

  // Inline form — defined here to avoid re-mount on keystroke
  const inlineForm = (onSave, onCancel, saveLabel) => (
    <div style={{ padding: "1rem", background: "var(--surface-2)" }}>
      <div className="form-grid" style={{ marginBottom: "1rem" }}>
        <div className="form-group">
          <label>{t("labelIRLDate")}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>{t("labelIRLTime")}</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={onSave} className="btn btn-primary" disabled={saving}>
          {saving ? t("saving") : saveLabel}
        </button>
        <button onClick={onCancel} className="btn btn-secondary">
          {t("cancelSlot")}
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
      {/* Read-only notice when the event is archived */}
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
      {error && !adding && !editingId && (
        <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}
      {sorted.length === 0 && !adding && (
        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <div className="empty" style={{ padding: "1.5rem" }}>
            {t("noStartTimes")}
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
          <table>
            <thead>
              <tr>
                <th>{t("colStartSlot")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((st) => (
                <React.Fragment key={st.id}>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {formatDateLabelInZone(st.irl_start, timezone, locale)}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--accent)",
                          marginTop: "0.1rem",
                        }}
                      >
                        {t("startAt", { time: formatTimeInZone(st.irl_start, timezone) })}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {/* Special event start times are auto-generated from predefined slots —
                      manual edit/delete is disabled to keep them in sync with the template. */}
                      {!isSpecial && isAdmin && !archived && (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            onClick={() => startEdit(st)}
                            className="btn btn-secondary btn-sm"
                          >
                            {t("editSlot")}
                          </button>
                          <button
                            onClick={() => handleDelete(st.id)}
                            className="btn btn-danger btn-sm"
                          >
                            {t("removeSlot")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {editingId === st.id && (
                    <tr>
                      <td colSpan={3} style={{ padding: 0 }}>
                        {inlineForm(handleSaveEdit, resetForm, t("submitSave"))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <div className="card">
          <h3 style={{ marginBottom: "1rem", color: "var(--text-dim)" }}>
            {t("newSlotTitle")}
          </h3>
          {inlineForm(handleAdd, resetForm, t("addSlot"))}
        </div>
      ) : (
        !editingId &&
        !isSpecial &&
        isAdmin &&
        !archived && (
          <button
            onClick={() => {
              setEditingId(null);
              setDate("");
              setTime("");
              setError(null);
              setAdding(true);
            }}
            className="btn btn-secondary"
          >
            {t("addSlotBtn")}
          </button>
        )
      )}
    </div>
  );
}
