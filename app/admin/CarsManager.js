"use client";
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

const emptyForm = { tank_size_litres: "", car_type_label: "" };

export default function CarsManager({ initialCars, iracingCars }) {
  const router = useRouter();
  const [cars, setCars] = useState(initialCars);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  // The iRacing catalog car currently selected in the form
  const [selectedIracingCar, setSelectedIracingCar] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Filter iRacing catalog by search query — max 20 results shown
  const filteredIracingCars = useMemo(() => {
    if (!searchQuery.trim() || selectedIracingCar) return [];
    const q = searchQuery.toLowerCase();
    return (iracingCars || [])
      .filter((c) => c.car_name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [searchQuery, iracingCars, selectedIracingCar]);

  // Select a car from the catalog dropdown
  const selectIracingCar = (car) => {
    setSelectedIracingCar(car);
    setSearchQuery(car.car_name);
    // Reset type label when switching car
    setForm((prev) => ({ ...prev, car_type_label: "" }));
  };

  // Clear the selection to allow re-searching
  const clearIracingCarSelection = () => {
    setSelectedIracingCar(null);
    setSearchQuery("");
    setForm((prev) => ({ ...prev, car_type_label: "" }));
  };

  const validate = () => {
    if (!selectedIracingCar) {
      setError("Sélectionnez une voiture depuis le catalogue iRacing.");
      return false;
    }
    if (!form.tank_size_litres) {
      setError("La taille du réservoir est obligatoire.");
      return false;
    }
    return true;
  };

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setSelectedIracingCar(null);
    setSearchQuery("");
    setForm(emptyForm);
    setError(null);
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from("cars")
      .insert([
        {
          name: selectedIracingCar.car_name,
          iracing_car_id: selectedIracingCar.iracing_car_id,
          car_type_label: form.car_type_label || null,
          tank_size_litres: parseFloat(form.tank_size_litres),
        },
      ])
      .select()
      .single();
    if (err) {
      setError(
        err.code === "23505"
          ? "Cette voiture est déjà dans le catalogue Kronos."
          : err.message,
      );
      setSaving(false);
      return;
    }
    setCars((prev) =>
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
      .from("cars")
      .update({
        name: selectedIracingCar.car_name,
        iracing_car_id: selectedIracingCar.iracing_car_id,
        car_type_label: form.car_type_label || null,
        tank_size_litres: parseFloat(form.tank_size_litres),
      })
      .eq("id", editingId)
      .select()
      .single();
    if (err) {
      setError(
        err.code === "23505"
          ? "Cette voiture est déjà dans le catalogue Kronos."
          : err.message,
      );
      setSaving(false);
      return;
    }
    setCars((prev) => prev.map((c) => (c.id === editingId ? data : c)));
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette voiture ?")) return;
    const { error: err } = await supabase.from("cars").delete().eq("id", id);
    if (err) {
      setError(
        err.code === "23503"
          ? "Cette voiture est utilisée par un ou plusieurs équipages et ne peut pas être supprimée."
          : err.message,
      );
      return;
    }
    setCars((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  };

  const startEdit = (car) => {
    setEditingId(car.id);
    // Find this car in the iRacing catalog by iracing_car_id
    const iracingCar = (iracingCars || []).find(
      (c) => c.iracing_car_id === car.iracing_car_id,
    );
    setSelectedIracingCar(
      iracingCar ||
        (car.iracing_car_id
          ? {
              iracing_car_id: car.iracing_car_id,
              car_name: car.name,
              car_types: [],
            }
          : null),
    );
    setSearchQuery(car.name);
    setForm({
      tank_size_litres: String(car.tank_size_litres),
      car_type_label: car.car_type_label || "",
    });
    setAdding(false);
    setError(null);
  };

  // Group cars by class for display
  const withClass = cars.filter((c) => c.class);
  const withoutClass = cars.filter((c) => !c.class);
  const carsByClass = withClass.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = [];
    acc[car.class].push(car);
    return acc;
  }, {});

  // Inline form — used for both add and edit
  const editForm = (
    <div style={{ padding: "1rem", background: "var(--surface-2)" }}>
      {/* iRacing catalog search / selection */}
      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label>Voiture iRacing</label>
        {!iracingCars?.length ? (
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-dim)",
              padding: "0.5rem 0",
            }}
          >
            ⚠️ Catalogue iRacing vide. Lancez une synchronisation iRacing
            d&apos;abord.
          </div>
        ) : selectedIracingCar ? (
          // Car is selected — show name + change button
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              {selectedIracingCar.car_name}
            </span>
            <button
              type="button"
              onClick={clearIracingCarSelection}
              className="btn btn-secondary btn-sm"
            >
              Changer
            </button>
          </div>
        ) : (
          // Search mode — text input + dropdown
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une voiture iRacing…"
              autoFocus={adding}
            />
            {filteredIracingCars.length > 0 && (
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
                  maxHeight: "250px",
                  overflowY: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}
              >
                {filteredIracingCars.map((car) => (
                  <div
                    key={car.iracing_car_id}
                    onClick={() => selectIracingCar(car)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      borderBottom: "1px solid var(--border)",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {car.car_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* car_types pills — pick the most representative tag for grouping */}
      {selectedIracingCar?.car_types?.length > 0 && (
        <div className="form-group" style={{ marginBottom: "1rem" }}>
          <label>
            Type de classe{" "}
            <span style={{ fontWeight: 400, color: "var(--text-dim)" }}>
              — sélectionnez le tag le plus représentatif (optionnel)
            </span>
          </label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
              marginTop: "0.5rem",
            }}
          >
            {selectedIracingCar.car_types.map((tag) => {
              const isSelected = form.car_type_label === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      // Click again to deselect
                      car_type_label: isSelected ? "" : tag,
                    }))
                  }
                  style={{
                    padding: "0.25rem 0.65rem",
                    borderRadius: "3px",
                    border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    background: isSelected
                      ? "var(--accent-dim)"
                      : "var(--surface)",
                    color: isSelected ? "var(--accent)" : "var(--text-dim)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {form.car_type_label && (
            <div
              style={{
                marginTop: "0.5rem",
                fontSize: "0.78rem",
                color: "var(--text-dim)",
              }}
            >
              Groupé sous :{" "}
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                {form.car_type_label.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tank size */}
      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label>Réservoir (litres)</label>
        <input
          type="number"
          value={form.tank_size_litres}
          onChange={set("tank_size_litres")}
          placeholder="ex : 99"
          min="0"
          max="999"
          step="0.1"
          style={{ maxWidth: "150px" }}
        />
      </div>

      <p
        style={{
          fontSize: "0.78rem",
          color: "var(--text-dim)",
          marginBottom: "1rem",
        }}
      >
        💡 La classe s&apos;assigne depuis l&apos;onglet{" "}
        <strong>Classes</strong>.
      </p>

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
          {saving ? "…" : editingId ? "✓ Enregistrer" : "✓ Ajouter"}
        </button>
        <button onClick={reset} className="btn btn-secondary">
          Annuler
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {!adding && !editingId && error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {adding && (
        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "var(--text-dim)" }}>
            Nouvelle voiture
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
          + Ajouter une voiture
        </button>
      )}

      <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
        <table>
          <thead>
            <tr>
              <th>Voiture</th>
              <th>Classe</th>
              <th>Type iRacing</th>
              <th>Réservoir</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {Object.entries(carsByClass).map(([cls, carsInClass]) => (
              <React.Fragment key={`class-${cls}`}>
                <tr style={{ background: "var(--surface-2)" }}>
                  <td
                    colSpan={5}
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      padding: "0.4rem 1rem",
                    }}
                  >
                    {cls}
                  </td>
                </tr>
                {carsInClass.map((car) => (
                  <React.Fragment key={car.id}>
                    <tr>
                      <td style={{ fontWeight: 600 }}>{car.name}</td>
                      <td>
                        <span className="badge badge-driver">{car.class}</span>
                      </td>
                      <td>
                        {car.car_type_label ? (
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--accent)",
                            }}
                          >
                            {car.car_type_label.toUpperCase()}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "var(--text-dim)",
                              fontSize: "0.78rem",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ color: "var(--accent)" }}>
                        {car.tank_size_litres}L
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
                            onClick={() => startEdit(car)}
                            className="btn btn-secondary btn-sm"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(car.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === car.id && (
                      <tr>
                        <td colSpan={5}>{editForm}</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}

            {withoutClass.length > 0 && (
              <React.Fragment key="unclassed">
                <tr style={{ background: "var(--surface-2)" }}>
                  <td
                    colSpan={5}
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--danger)",
                      padding: "0.4rem 1rem",
                    }}
                  >
                    ⚠️ Non classées
                  </td>
                </tr>
                {withoutClass.map((car) => (
                  <React.Fragment key={car.id}>
                    <tr>
                      <td style={{ fontWeight: 600 }}>{car.name}</td>
                      <td>
                        <span
                          style={{
                            color: "var(--text-dim)",
                            fontSize: "0.78rem",
                          }}
                        >
                          Non classée
                        </span>
                      </td>
                      <td>
                        {car.car_type_label ? (
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--accent)",
                            }}
                          >
                            {car.car_type_label.toUpperCase()}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "var(--text-dim)",
                              fontSize: "0.78rem",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ color: "var(--accent)" }}>
                        {car.tank_size_litres}L
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
                            onClick={() => startEdit(car)}
                            className="btn btn-secondary btn-sm"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(car.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === car.id && (
                      <tr>
                        <td colSpan={5}>{editForm}</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            )}

            {cars.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Aucune voiture.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
