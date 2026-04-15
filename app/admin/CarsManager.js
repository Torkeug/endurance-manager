"use client";
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

// ─── Shared styles ───────────────────────────────────────────────────────────

const TH = {
  background: "var(--surface-2)",
  color: "var(--text-dim)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "0.6rem 1rem",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD = {
  padding: "0.6rem 1rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

// ─── Car type tag pills ───────────────────────────────────────────────────────
// Shared between both tabs — shows iRacing car_types as selectable pills
// plus a free-text input for manual override.
function CarTypePicker({ carTypes, value, onChange }) {
  return (
    <div>
      {carTypes?.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            margin: "0.5rem 0",
          }}
        >
          {[...new Set(carTypes)].map((tag) => {
            const isSelected = value === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onChange(isSelected ? "" : tag)}
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
      )}
      {/* Free text — always editable, pills just pre-fill it */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ex: gt3, gte, gtp, lmp2…"
        style={{ maxWidth: "200px" }}
      />
      {value && (
        <div
          style={{
            marginTop: "0.4rem",
            fontSize: "0.78rem",
            color: "var(--text-dim)",
          }}
        >
          Groupé sous :{" "}
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>
            {value.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Kronos Endurance tab ─────────────────────────────────────────────────────
// Manages cars used in events — linked to iRacing catalog, with tank size and class.
function KronosEnduranceTab({ initialCars, iracingCars }) {
  const router = useRouter();
  const [cars, setCars] = useState(initialCars);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    tank_size_litres: "",
    car_type_label: "",
  });
  const [selectedIracingCar, setSelectedIracingCar] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const filteredIracingCars = useMemo(() => {
    if (!searchQuery.trim() || selectedIracingCar) return [];
    const q = searchQuery.toLowerCase();
    return (iracingCars || [])
      .filter((c) => c.car_name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [searchQuery, iracingCars, selectedIracingCar]);

  const selectIracingCar = (car) => {
    setSelectedIracingCar(car);
    setSearchQuery(car.car_name);
    setForm((prev) => ({ ...prev, car_type_label: car.car_type_label || "" }));
  };

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
    return true;
  };

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setSelectedIracingCar(null);
    setSearchQuery("");
    setForm({ tank_size_litres: "", car_type_label: "" });
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
          tank_size_litres: form.tank_size_litres
            ? parseFloat(form.tank_size_litres)
            : null,
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
        tank_size_litres: form.tank_size_litres
          ? parseFloat(form.tank_size_litres)
          : null,
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
              car_type_label: null,
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

  const withClass = cars.filter((c) => c.class);
  const withoutClass = cars.filter((c) => !c.class);
  const carsByClass = withClass.reduce((acc, car) => {
    if (!acc[car.class]) acc[car.class] = [];
    acc[car.class].push(car);
    return acc;
  }, {});

  const editForm = (
    <div style={{ padding: "1rem", background: "var(--surface-2)" }}>
      {/* iRacing catalog search */}
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

      {/* Type label picker */}
      {selectedIracingCar && (
        <div className="form-group" style={{ marginBottom: "1rem" }}>
          <label>
            Type de classe{" "}
            <span style={{ fontWeight: 400, color: "var(--text-dim)" }}>
              — sélectionnez un tag ou saisissez manuellement (optionnel)
            </span>
          </label>
          <CarTypePicker
            carTypes={selectedIracingCar.car_types}
            value={form.car_type_label}
            onChange={(val) =>
              setForm((prev) => ({ ...prev, car_type_label: val }))
            }
          />
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

// ─── Catalogue iRacing tab ────────────────────────────────────────────────────
// Shows all iRacing cars — admin can set car_type_label for inventory grouping.
// Has no impact on the endurance/event side.
function IracingCatalogueTab({ iracingCars, setIracingCars }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  // Inline edit state per car
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  const filteredCars = useMemo(() => {
    if (!searchQuery.trim()) return iracingCars;
    const q = searchQuery.toLowerCase();
    return iracingCars.filter((c) => c.car_name.toLowerCase().includes(q));
  }, [searchQuery, iracingCars]);

  const openEdit = (car) => {
    setEditingId(car.iracing_car_id);
    setEditLabel(car.car_type_label || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
  };

  const saveLabel = async (car) => {
    setSaving(car.iracing_car_id);
    setError(null);
    const { error: err } = await supabase
      .from("iracing_cars")
      .update({ car_type_label: editLabel.trim() || null })
      .eq("iracing_car_id", car.iracing_car_id);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setIracingCars((prev) =>
      prev.map((c) =>
        c.iracing_car_id === car.iracing_car_id
          ? { ...c, car_type_label: editLabel.trim() || null }
          : c,
      ),
    );
    setSaving(null);
    setEditingId(null);
    setEditLabel("");
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--text-dim)",
          marginBottom: "1rem",
        }}
      >
        Assignez un label de type à chaque voiture iRacing pour le regroupement
        dans l&apos;inventaire des pilotes. Ces labels n&apos;affectent pas les
        événements ou équipages.
      </p>

      {/* Search */}
      <div style={{ marginBottom: "1rem", maxWidth: "400px" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher dans le catalogue iRacing…"
        />
      </div>

      {iracingCars.length === 0 ? (
        <div className="card">
          <div className="empty">
            Catalogue iRacing vide. Lancez une synchronisation iRacing depuis
            votre profil.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Voiture</th>
                <th style={TH}>Tags iRacing</th>
                <th style={TH}>Label inventaire</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>
              {filteredCars.map((car) => {
                const isEditing = editingId === car.iracing_car_id;
                return (
                  <tr
                    key={car.iracing_car_id}
                    style={{ opacity: saving === car.iracing_car_id ? 0.5 : 1 }}
                  >
                    {/* Car name */}
                    <td style={{ ...TD, fontWeight: 600, fontSize: "0.85rem" }}>
                      {car.car_name}
                    </td>

                    {/* car_types tags — display only */}
                    <td style={TD}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.3rem",
                        }}
                      >
                        {[...new Set(car.car_types || [])].map((tag) => (
                          <span
                            key={tag}
                            className="mono"
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-dim)",
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "3px",
                              padding: "0.1rem 0.35rem",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Label — editable */}
                    <td style={TD}>
                      {isEditing ? (
                        <CarTypePicker
                          carTypes={car.car_types}
                          value={editLabel}
                          onChange={setEditLabel}
                        />
                      ) : car.car_type_label ? (
                        <span
                          className="mono"
                          style={{
                            fontSize: "0.82rem",
                            color: "var(--accent)",
                            fontWeight: 700,
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

                    {/* Actions */}
                    <td style={{ ...TD, textAlign: "right" }}>
                      {isEditing ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.4rem",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            onClick={() => saveLabel(car)}
                            className="btn btn-primary btn-sm"
                            disabled={saving === car.iracing_car_id}
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="btn btn-secondary btn-sm"
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openEdit(car)}
                          className="btn btn-secondary btn-sm"
                          disabled={!!saving}
                        >
                          ✏️ Modifier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
// Two-tab wrapper: Kronos Endurance (event cars) + Catalogue iRacing (inventory labels)
export default function CarsManager({
  initialCars,
  iracingCars: initialIracingCars,
}) {
  const [activeTab, setActiveTab] = useState("kronos");
  // Lifted state — persists across tab switches within CarsManager
  const [iracingCars, setIracingCars] = useState(initialIracingCars);

  const tabs = [
    { id: "kronos", label: "Kronos Endurance" },
    { id: "catalogue", label: "Catalogue iRacing" },
  ];

  return (
    <div>
      {/* Sub-tab switcher */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "0.5rem 1.25rem",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-dim)",
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "kronos" && (
        <KronosEnduranceTab
          initialCars={initialCars}
          iracingCars={iracingCars}
        />
      )}
      {activeTab === "catalogue" && (
        <IracingCatalogueTab
          iracingCars={iracingCars}
          setIracingCars={setIracingCars}
        />
      )}
    </div>
  );
}
