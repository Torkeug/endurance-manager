"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

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
              {t("eventTypesActiveIntro")}{" "}
              <strong style={{ color: "var(--text)" }}>
                {t("eventTypesActiveCount", { count: modal.activeEvents.length })}
              </strong>{" "}
              {t("eventTypesActiveSuffix")}
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
            {t("eventTypesArchivedNote", { count: modal.archivedCount })}
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
            {t("eventTypesNoImpact")}
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

export default function EventTypesManager({
  initialEventTypes,
  initialEventTypeCars,
  cars,
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [eventTypes, setEventTypes] = useState(initialEventTypes);
  const [eventTypeCars, setEventTypeCars] = useState(initialEventTypeCars);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setNewName("");
    setError(null);
  };

  // Returns car IDs explicitly allowed for this event type.
  // An empty array means ALL cars are allowed (no restriction).
  const getAllowedCarIds = (eventTypeId) =>
    eventTypeCars
      .filter((etc) => etc.event_type_id === eventTypeId)
      .map((etc) => etc.car_id);

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("event_types")
      .insert([
        { name: newName.trim(), sort_order: (eventTypes.length + 1) * 10 },
      ])
      .select()
      .single();
    if (err) {
      if (err.code === "23505") {
        setError(t("errorNameExists"));
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }
    setEventTypes((prev) => [...prev, data]);
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleEdit = async () => {
    if (!newName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("event_types")
      .update({ name: newName.trim() })
      .eq("id", editingId)
      .select()
      .single();
    if (err) {
      if (err.code === "23505") {
        setError(t("errorNameExists"));
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }
    setEventTypes((prev) => prev.map((tp) => (tp.id === editingId ? data : tp)));
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id) => {
    const et = eventTypes.find((tp) => tp.id === id);

    const { data: affectedEventsData } = await supabase
      .from("events")
      .select("name, archived")
      .eq("format", et?.name);

    const activeEvents = (affectedEventsData || [])
      .filter((e) => !e.archived)
      .map((e) => e.name);

    const archivedCount = (affectedEventsData || []).filter(
      (e) => e.archived,
    ).length;

    setConfirmModal({
      title: t("eventTypesDeleteTitle", { name: et?.name }),
      activeEvents,
      archivedCount,
      confirmLabel: t("delete"),
      onConfirm: async () => {
        setConfirmModal(null);
        // Null out format on active events before deleting the type
        if (activeEvents.length > 0) {
          await supabase
            .from("events")
            .update({ format: null })
            .eq("format", et?.name)
            .eq("archived", false);
        }
        const { error: err } = await supabase
          .from("event_types")
          .delete()
          .eq("id", id);
        if (err) {
          setError(err.message);
          return;
        }
        setEventTypes((prev) => prev.filter((tp) => tp.id !== id));
        setEventTypeCars((prev) =>
          prev.filter((etc) => etc.event_type_id !== id),
        );
        if (expandedId === id) setExpandedId(null);
        router.refresh();
      },
    });
  };

  // Toggles a car's presence in event_type_cars.
  // Delete if currently allowed, insert if not — no upsert needed since it's a simple junction table.
  const toggleCar = async (eventTypeId, carId, currentlyAllowed) => {
    if (currentlyAllowed) {
      const { error: err } = await supabase
        .from("event_type_cars")
        .delete()
        .eq("event_type_id", eventTypeId)
        .eq("car_id", carId);
      if (err) {
        setError(err.message);
        return;
      }
      setEventTypeCars((prev) =>
        prev.filter(
          (etc) => !(etc.event_type_id === eventTypeId && etc.car_id === carId),
        ),
      );
    } else {
      const { error: err } = await supabase
        .from("event_type_cars")
        .insert([{ event_type_id: eventTypeId, car_id: carId }]);
      if (err) {
        setError(err.message);
        return;
      }
      setEventTypeCars((prev) => [
        ...prev,
        { event_type_id: eventTypeId, car_id: carId },
      ]);
    }
    router.refresh();
  };

  const startEdit = (et) => {
    setEditingId(et.id);
    setNewName(et.name);
    setAdding(false);
    setError(null);
  };

  // Group cars by class for display — fall back to "Autre" for cars without a class
  const carsByClass = cars.reduce((acc, car) => {
    const key = car.class || "Autre";
    if (!acc[key]) acc[key] = [];
    acc[key].push(car);
    return acc;
  }, {});

  return (
    <div>
      <ConfirmModal
        modal={confirmModal}
        onConfirm={() => confirmModal?.onConfirm?.()}
        onCancel={() => setConfirmModal(null)}
      />
      {error && !editingId && !adding && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {adding ? (
        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <div
            style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}
          >
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t("eventTypesNewLabel")}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("eventTypesNewPlaceholder")}
                autoFocus
              />
            </div>
            <button
              onClick={handleAdd}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? t("saving") : t("add")}
            </button>
            <button onClick={reset} className="btn btn-secondary">
              {t("cancel")}
            </button>
          </div>
          {error && (
            <div className="alert alert-error" style={{ marginTop: "0.75rem" }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="btn btn-primary"
          style={{ marginBottom: "0.75rem" }}
        >
          {t("eventTypesAddBtn")}
        </button>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        {eventTypes.map((et) => {
          const allowedCarIds = getAllowedCarIds(et.id);
          const isExpanded = expandedId === et.id;
          const isEditing = editingId === et.id;

          return (
            <div
              key={et.id}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.85rem 1rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {et.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-dim)",
                      marginTop: "0.2rem",
                    }}
                  >
                    {allowedCarIds.length === 0
                      ? t("eventTypesAllCars")
                      : t("eventTypesCarsCount", { count: allowedCarIds.length })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : et.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    {t("eventTypesToggle", { expanded: isExpanded ? "true" : "false" })}
                  </button>
                  <button
                    onClick={() => startEdit(et)}
                    className="btn btn-secondary btn-sm"
                  >
                    {t("edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(et.id)}
                    className="btn btn-danger btn-sm"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>

              {/* Edit name inline */}
              {isEditing && (
                <div
                  style={{
                    padding: "1rem",
                    background: "var(--surface-2)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "flex-end",
                    }}
                  >
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>{t("eventTypesNameLabel")}</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleEdit}
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? t("saving") : t("save")}
                    </button>
                    <button onClick={reset} className="btn btn-secondary">
                      {t("cancel")}
                    </button>
                  </div>
                  {error && (
                    <div
                      className="alert alert-error"
                      style={{ marginTop: "0.75rem" }}
                    >
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* Car selector */}
              {isExpanded && (
                <div
                  style={{
                    padding: "1rem",
                    borderTop: "1px solid var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-dim)",
                      marginBottom: "1rem",
                    }}
                  >
                    {t("eventTypesCarsHint")}
                  </p>
                  {Object.entries(carsByClass).map(([cls, carsInClass]) => {
                    const allChecked = carsInClass.every((car) =>
                      allowedCarIds.includes(car.id),
                    );
                    const someChecked = carsInClass.some((car) =>
                      allowedCarIds.includes(car.id),
                    );

                    // Toggles all cars in a class at once with batched DB ops + single state update.
                    // If all are checked → remove all; if any are unchecked → add all missing ones.
                    const toggleClass = async () => {
                      const toRemove = allChecked
                        ? carsInClass.filter((car) => allowedCarIds.includes(car.id))
                        : [];
                      const toAdd = !allChecked
                        ? carsInClass.filter((car) => !allowedCarIds.includes(car.id))
                        : [];

                      const ops = [];
                      if (toRemove.length > 0)
                        ops.push(
                          supabase
                            .from("event_type_cars")
                            .delete()
                            .eq("event_type_id", et.id)
                            .in("car_id", toRemove.map((c) => c.id)),
                        );
                      if (toAdd.length > 0)
                        ops.push(
                          supabase
                            .from("event_type_cars")
                            .insert(toAdd.map((car) => ({ event_type_id: et.id, car_id: car.id }))),
                        );

                      const results = await Promise.all(ops);
                      const failed = results.find((r) => r.error);
                      if (failed) { setError(failed.error.message); return; }

                      setEventTypeCars((prev) => {
                        let next = prev.filter(
                          (etc) =>
                            !(
                              etc.event_type_id === et.id &&
                              toRemove.some((c) => c.id === etc.car_id)
                            ),
                        );
                        next = [
                          ...next,
                          ...toAdd.map((car) => ({ event_type_id: et.id, car_id: car.id })),
                        ];
                        return next;
                      });
                      router.refresh();
                    };

                    return (
                      <div key={cls} style={{ marginBottom: "1rem" }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "var(--text-dim)",
                            marginBottom: "0.5rem",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={toggleClass}
                            style={{ accentColor: "var(--accent)" }}
                          />
                          {cls}
                          {someChecked && !allChecked && (
                            <span
                              style={{
                                color: "var(--accent)",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                              }}
                            >
                              (
                              {
                                carsInClass.filter((car) =>
                                  allowedCarIds.includes(car.id),
                                ).length
                              }
                              /{carsInClass.length})
                            </span>
                          )}
                        </label>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.4rem",
                            paddingLeft: "1.5rem",
                          }}
                        >
                          {carsInClass.map((car) => {
                            const allowed = allowedCarIds.includes(car.id);
                            return (
                              <label
                                key={car.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  padding: "0.4rem 0.7rem",
                                  background: allowed
                                    ? "var(--accent-dim)"
                                    : "var(--surface)",
                                  border: "1px solid",
                                  borderColor: allowed
                                    ? "var(--accent)"
                                    : "var(--border)",
                                  borderRadius: "3px",
                                  cursor: "pointer",
                                  transition: "all 0.15s",
                                  fontSize: "0.85rem",
                                  fontWeight: 600,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={allowed}
                                  onChange={() =>
                                    toggleCar(et.id, car.id, allowed)
                                  }
                                  style={{ accentColor: "var(--accent)" }}
                                />
                                {car.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {eventTypes.length === 0 && (
          <div className="card">
            <div className="empty">{t("eventTypesEmpty")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
