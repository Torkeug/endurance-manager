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

        {modal.affectedCars?.length > 0 && (
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text-dim)",
              marginBottom: "0.5rem",
            }}
          >
            ⚠️{" "}
            <strong style={{ color: "var(--text)" }}>
              {t("classesCarsCount", { count: modal.affectedCars.length })}
            </strong>{" "}
            {t("classesCarsUnclassed")}{" "}
            <span style={{ color: "var(--danger)" }}>
              {modal.affectedCars.join(", ")}
            </span>
          </p>
        )}

        {modal.affectedEvents?.length > 0 && (
          <>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-dim)",
                marginBottom: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              {t("classesEventsWarningIntro")}{" "}
              <strong style={{ color: "var(--text)" }}>
                {t("classesEventsCount", { count: modal.affectedEvents.length })}
              </strong>{" "}
              :
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
              {modal.affectedEvents.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </>
        )}

        {!modal.affectedCars?.length && !modal.affectedEvents?.length && (
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text-dim)",
              marginBottom: "1rem",
            }}
          >
            {t("classesNoImpact")}
          </p>
        )}

        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-dim)",
            marginBottom: "1.5rem",
            marginTop: "0.5rem",
          }}
        >
          {t("classesArchivedNote")}
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

export default function ClassesManager({ initialClasses, initialCars }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [cars, setCars] = useState(initialCars);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  // Tracks refuel rate edits per class — key is class id, value is input string
  const [refuelRates, setRefuelRates] = useState(
    Object.fromEntries(
      initialClasses.map((c) => [c.id, c.refuel_litres_per_second ?? ""]),
    ),
  );
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setNewName("");
    setError(null);
  };

  const getCarsInClass = (className) =>
    cars.filter((c) => c.class === className);
  // A car is "unclassed" if it has no class set, OR if its class no longer
  // exists in the classes list (e.g. class was deleted while car still references it)
  const getUnclassedCars = () =>
    cars.filter((c) => !c.class || !classes.find((cl) => cl.name === c.class));

  const assignCar = async (carId, className) => {
    const { data, error: err } = await supabase
      .from("cars")
      .update({ class: className })
      .eq("id", carId)
      .select()
      .single();
    if (err) {
      if (err.code === "23505") {
        setError(t("errorNameExists"));
      } else {
        setError(err.message);
      }
      return;
    }
    setCars((prev) => prev.map((c) => (c.id === carId ? data : c)));
    router.refresh();
  };

  const unassignCar = async (carId) => {
    const { data, error: err } = await supabase
      .from("cars")
      .update({ class: null })
      .eq("id", carId)
      .select()
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setCars((prev) => prev.map((c) => (c.id === carId ? data : c)));
    router.refresh();
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("car_classes")
      .insert([
        {
          name: newName.trim(),
          sort_order: (classes.length + 1) * 10,
          refuel_litres_per_second: null,
        },
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
    setClasses((prev) => [...prev, data]);
    setRefuelRates((prev) => ({ ...prev, [data.id]: "" }));
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleEdit = async () => {
    if (!newName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    const oldClass = classes.find((c) => c.id === editingId);
    setSaving(true);
    const { data, error: err } = await supabase
      .from("car_classes")
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

    // Class name is stored as a string on cars.class — if the class is renamed,
    // we must update all cars referencing the old name to keep them consistent.
    // Not atomic: if car update fails the class_name is already changed. Surface error so admin can retry.
    if (oldClass && oldClass.name !== newName.trim()) {
      const { error: carsErr } = await supabase
        .from("cars")
        .update({ class: newName.trim() })
        .eq("class", oldClass.name);
      if (carsErr) {
        // Roll back the class rename so the DB stays consistent
        await supabase
          .from("car_classes")
          .update({ name: oldClass.name })
          .eq("id", editingId);
        setError(`Erreur lors de la mise à jour des voitures. Renommage annulé : ${carsErr.message}`);
        setSaving(false);
        return;
      }
      setCars((prev) =>
        prev.map((c) =>
          c.class === oldClass.name ? { ...c, class: newName.trim() } : c,
        ),
      );
    }

    setClasses((prev) => prev.map((c) => (c.id === editingId ? data : c)));
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id, className) => {
    const carsInClass = getCarsInClass(className);

    // Check non-archived events using this class in team entries
    const { data: teamEntries } = await supabase
      .from("team_entries")
      .select("events(name, archived)")
      .eq("class", className);

    const affectedEvents = [
      ...new Set(
        (teamEntries || [])
          .filter((te) => !te.events?.archived)
          .map((te) => te.events?.name)
          .filter(Boolean),
      ),
    ];

    setConfirmModal({
      title: t("classesDeleteTitle", { name: className }),
      affectedCars: carsInClass.map((c) => c.name),
      affectedEvents,
      confirmLabel: t("delete"),
      onConfirm: async () => {
        setConfirmModal(null);
        const { error: err } = await supabase
          .from("car_classes")
          .delete()
          .eq("id", id);
        if (err) {
          setError(err.message);
          return;
        }
        if (carsInClass.length > 0) {
          await supabase
            .from("cars")
            .update({ class: null })
            .eq("class", className);
          setCars((prev) =>
            prev.map((c) =>
              c.class === className ? { ...c, class: null } : c,
            ),
          );
        }
        setClasses((prev) => prev.filter((c) => c.id !== id));
        setRefuelRates((prev) => { const next = { ...prev }; delete next[id]; return next; });
        if (expandedId === id) setExpandedId(null);
        router.refresh();
      },
    });
  };

  const startEdit = (cls) => {
    setEditingId(cls.id);
    setNewName(cls.name);
    setAdding(false);
    setError(null);
  };

  // Save refuel rate for a class immediately on blur
  const handleRefuelRate = async (classId, value) => {
    const parsed = value ? parseFloat(value) : null;
    const { error: err } = await supabase
      .from("car_classes")
      .update({ refuel_litres_per_second: parsed })
      .eq("id", classId);
    if (err) setError(err.message);
    else router.refresh();
  };

  const unclassedCars = getUnclassedCars();

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
              <label>{t("classesNewLabel")}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("classesNewPlaceholder")}
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
          {t("classesAddBtn")}
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
        {classes.map((cls) => {
          const carsInClass = getCarsInClass(cls.name);
          const isExpanded = expandedId === cls.id;
          const isEditing = editingId === cls.id;

          return (
            <div
              key={cls.id}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              {/* Header */}
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
                  <span
                    className="badge badge-driver"
                    style={{ fontSize: "0.9rem", padding: "0.25rem 0.6rem" }}
                  >
                    {cls.name}
                  </span>
                  <span
                    style={{
                      marginLeft: "0.75rem",
                      fontSize: "0.8rem",
                      color: "var(--text-dim)",
                    }}
                  >
                    {t("classesCarsCount", { count: carsInClass.length })}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Refuel rate — custom +/− stepper, saves on blur */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      fontSize: "0.8rem",
                    }}
                  >
                    <span
                      style={{
                        padding: "0.3rem 0.5rem",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRight: "none",
                        borderRadius: "3px 0 0 3px",
                        color: "var(--text-dim)",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {t("classesRefuelLabel")}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(
                          0,
                          parseFloat(refuelRates[cls.id] || 0) - 0.05,
                        );
                        const rounded = Math.round(val * 100) / 100;
                        setRefuelRates((prev) => ({
                          ...prev,
                          [cls.id]: rounded,
                        }));
                        handleRefuelRate(cls.id, rounded);
                      }}
                      style={{
                        padding: "0.3rem 0.5rem",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRight: "none",
                        color: "var(--text-dim)",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        lineHeight: 1,
                      }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.05"
                      value={refuelRates[cls.id] ?? ""}
                      onChange={(e) =>
                        setRefuelRates((prev) => ({
                          ...prev,
                          [cls.id]: e.target.value,
                        }))
                      }
                      onBlur={(e) => handleRefuelRate(cls.id, e.target.value)}
                      placeholder="—"
                      className="no-arrows"
                      style={{
                        width: "56px",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 0,
                        color: "var(--text)",
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "0.8rem",
                        padding: "0.3rem 0.4rem",
                        textAlign: "center",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseFloat(refuelRates[cls.id] || 0) + 0.05;
                        const rounded = Math.round(val * 100) / 100;
                        setRefuelRates((prev) => ({
                          ...prev,
                          [cls.id]: rounded,
                        }));
                        handleRefuelRate(cls.id, rounded);
                      }}
                      style={{
                        padding: "0.3rem 0.5rem",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderLeft: "none",
                        color: "var(--text-dim)",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        lineHeight: 1,
                      }}
                    >
                      +
                    </button>
                    <span
                      style={{
                        padding: "0.3rem 0.5rem",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderLeft: "none",
                        borderRadius: "0 3px 3px 0",
                        color: "var(--text-dim)",
                        display: "flex",
                        alignItems: "center",
                        fontSize: "0.8rem",
                      }}
                    >
                      {t("classesRefuelUnit")}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cls.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    {t("classesToggle", { expanded: isExpanded ? "true" : "false" })}
                  </button>
                  <button
                    onClick={() => startEdit(cls)}
                    className="btn btn-secondary btn-sm"
                  >
                    {t("edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(cls.id, cls.name)}
                    className="btn btn-danger btn-sm"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>

              {/* Edit name */}
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
                      <label>{t("classesNameLabel")}</label>
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

              {/* Cars in class */}
              {isExpanded && (
                <div
                  style={{
                    padding: "1rem",
                    borderTop: "1px solid var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  {/* Current cars */}
                  {carsInClass.length > 0 && (
                    <div style={{ marginBottom: "1rem" }}>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--text-dim)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {t("classesAssigned")}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.4rem",
                        }}
                      >
                        {carsInClass.map((car) => (
                          <div
                            key={car.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.4rem 0.5rem 0.4rem 0.8rem",
                              background: "var(--accent-dim)",
                              border: "1px solid var(--accent)",
                              borderRadius: "3px",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                            }}
                          >
                            {car.name}
                            <button
                              onClick={() => unassignCar(car.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--accent)",
                                fontSize: "1rem",
                                lineHeight: 1,
                                padding: "0",
                              }}
                              title={t("classesRemoveTitle")}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unclassed cars to assign */}
                  {unclassedCars.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--text-dim)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {t("classesUnassigned")}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.4rem",
                        }}
                      >
                        {unclassedCars.map((car) => (
                          <button
                            key={car.id}
                            onClick={() => assignCar(car.id, cls.name)}
                            style={{
                              padding: "0.4rem 0.8rem",
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "3px",
                              color: "var(--text-dim)",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            + {car.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {carsInClass.length === 0 && unclassedCars.length === 0 && (
                    <p
                      style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}
                    >
                      {t("classesAllAssigned")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {classes.length === 0 && (
          <div className="card">
            <div className="empty">{t("classesEmpty")}</div>
          </div>
        )}
      </div>

      {/* Unclassed cars summary */}
      {unclassedCars.length > 0 && (
        <div
          className="card"
          style={{ marginBottom: "0.75rem", borderColor: "var(--accent-dim)" }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              marginBottom: "0.5rem",
            }}
          >
            {t("classesUnclassedWarning", { count: unclassedCars.length })}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
            {unclassedCars.map((c) => c.name).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
