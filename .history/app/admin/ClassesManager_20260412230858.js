"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function ClassesManager({ initialClasses, initialCars }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [cars, setCars] = useState(initialCars);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
        setError("Ce nom existe déjà.");
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
      if (err.code === "23505") {
        setError("Ce nom existe déjà.");
      } else {
        setError(err.message);
      }
      return;
    }
    setCars((prev) => prev.map((c) => (c.id === carId ? data : c)));
    router.refresh();
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("car_classes")
      .insert([{ name: newName.trim(), sort_order: (classes.length + 1) * 10 }])
      .select()
      .single();
    if (err) {
      if (err.code === "23505") {
        setError("Ce nom existe déjà.");
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }
    setClasses((prev) => [...prev, data]);
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleEdit = async () => {
    if (!newName.trim()) {
      setError("Le nom est obligatoire.");
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
        setError("Ce nom existe déjà.");
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }

    // Class name is stored as a string on cars.class — if the class is renamed,
    // we must update all cars referencing the old name to keep them consistent
    if (oldClass && oldClass.name !== newName.trim()) {
      await supabase
        .from("cars")
        .update({ class: newName.trim() })
        .eq("class", oldClass.name);
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
    const msg =
      carsInClass.length > 0
        ? `Supprimer la classe "${className}" ? Les ${carsInClass.length} voiture(s) associées seront déclassées.`
        : `Supprimer la classe "${className}" ?`;
    if (!confirm(msg)) return;

    const { error: err } = await supabase
      .from("car_classes")
      .delete()
      .eq("id", id);
    if (err) {
      if (err.code === "23503") {
        setError("Cette classe est utilisée et ne peut pas être supprimée.");
      } else {
        setError(err.message);
      }
      return;
    }

    // On delete, unclass all cars in this class rather than blocking deletion.
    // Admin is warned via the confirm dialog how many cars will be affected.
    if (carsInClass.length > 0) {
      await supabase
        .from("cars")
        .update({ class: null })
        .eq("class", className);
      setCars((prev) =>
        prev.map((c) => (c.class === className ? { ...c, class: null } : c)),
      );
    }

    setClasses((prev) => prev.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
    router.refresh();
  };

  const startEdit = (cls) => {
    setEditingId(cls.id);
    setNewName(cls.name);
    setAdding(false);
    setError(null);
  };

  const unclassedCars = getUnclassedCars();

  return (
    <div>
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
              <label>Nouvelle classe</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex : LMP3"
                autoFocus
              />
            </div>
            <button
              onClick={handleAdd}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "…" : "✓ Ajouter"}
            </button>
            <button onClick={reset} className="btn btn-secondary">
              Annuler
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
          + Ajouter une classe
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
                    {carsInClass.length} voiture
                    {carsInClass.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cls.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    {isExpanded ? "▲ Voitures" : "▼ Voitures"}
                  </button>
                  <button
                    onClick={() => startEdit(cls)}
                    className="btn btn-secondary btn-sm"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(cls.id, cls.name)}
                    className="btn btn-danger btn-sm"
                  >
                    Supprimer
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
                      <label>Nom de la classe</label>
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
                      {saving ? "…" : "✓ Enregistrer"}
                    </button>
                    <button onClick={reset} className="btn btn-secondary">
                      Annuler
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
                        Voitures assignées
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
                              title="Retirer de cette classe"
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
                        Voitures non classées — cliquer pour assigner
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
                      Toutes les voitures sont déjà assignées à une classe.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {classes.length === 0 && (
          <div className="card">
            <div className="empty">Aucune classe configurée.</div>
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
            ⚠️ {unclassedCars.length} voiture
            {unclassedCars.length > 1 ? "s" : ""} sans classe
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
            {unclassedCars.map((c) => c.name).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
