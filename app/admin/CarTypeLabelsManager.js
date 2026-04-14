"use client";
import { useState } from "react";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

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

export default function CarTypeLabelsManager({ initialLabels }) {
  const [labels, setLabels] = useState(initialLabels || []);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  // New row form state
  const [newCarType, setNewCarType] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPriority, setNewPriority] = useState("");

  // Inline edit state — tracks which row is being edited
  const [editingRow, setEditingRow] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPriority, setEditPriority] = useState("");

  const addLabel = async () => {
    if (!newCarType.trim() || !newLabel.trim() || !newPriority) return;
    setSaving("add");
    setError(null);
    const { error: err } = await supabase.from("car_type_labels").insert({
      car_type: newCarType.trim().toLowerCase(),
      label: newLabel.trim(),
      priority: parseInt(newPriority),
    });
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    // Reload and re-sort
    setLabels((prev) =>
      [
        ...prev,
        {
          car_type: newCarType.trim().toLowerCase(),
          label: newLabel.trim(),
          priority: parseInt(newPriority),
        },
      ].sort((a, b) => a.priority - b.priority),
    );
    setNewCarType("");
    setNewLabel("");
    setNewPriority("");
    setSaving(null);
  };

  const openEdit = (row) => {
    setEditingRow(row.car_type);
    setEditLabel(row.label);
    setEditPriority(String(row.priority));
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditLabel("");
    setEditPriority("");
  };

  const saveEdit = async (carType) => {
    setSaving(carType);
    setError(null);
    const { error: err } = await supabase
      .from("car_type_labels")
      .update({ label: editLabel.trim(), priority: parseInt(editPriority) })
      .eq("car_type", carType);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setLabels((prev) =>
      prev
        .map((l) =>
          l.car_type === carType
            ? {
                ...l,
                label: editLabel.trim(),
                priority: parseInt(editPriority),
              }
            : l,
        )
        .sort((a, b) => a.priority - b.priority),
    );
    setSaving(null);
    setEditingRow(null);
  };

  const deleteLabel = async (carType) => {
    if (
      !confirm(
        `Supprimer le type "${carType}" ? Cette action est irréversible.`,
      )
    )
      return;
    setSaving(carType);
    setError(null);
    const { error: err } = await supabase
      .from("car_type_labels")
      .delete()
      .eq("car_type", carType);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    setLabels((prev) => prev.filter((l) => l.car_type !== carType));
    setSaving(null);
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Add new row form */}
      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "var(--text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "0.3rem",
            }}
          >
            car_type
          </div>
          <input
            type="text"
            value={newCarType}
            onChange={(e) => setNewCarType(e.target.value)}
            placeholder="ex: gt3"
            className="mono"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text)",
              fontSize: "0.85rem",
              padding: "0.4rem 0.6rem",
              width: "120px",
            }}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "var(--text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "0.3rem",
            }}
          >
            Label
          </div>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="ex: GT3"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text)",
              fontSize: "0.85rem",
              padding: "0.4rem 0.6rem",
              width: "120px",
            }}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "var(--text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "0.3rem",
            }}
          >
            Priorité
          </div>
          <input
            type="number"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            placeholder="ex: 70"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text)",
              fontSize: "0.85rem",
              padding: "0.4rem 0.6rem",
              width: "80px",
            }}
          />
        </div>
        <button
          onClick={addLabel}
          disabled={
            saving === "add" ||
            !newCarType.trim() ||
            !newLabel.trim() ||
            !newPriority
          }
          className="btn btn-primary btn-sm"
        >
          + Ajouter
        </button>
      </div>

      {/* Labels table */}
      {labels.length === 0 ? (
        <div className="card">
          <div className="empty">Aucun type défini.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>car_type</th>
                <th style={TH}>Label affiché</th>
                <th style={TH}>Priorité</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>
              {labels.map((row) => {
                const isEditing = editingRow === row.car_type;
                return (
                  <tr
                    key={row.car_type}
                    style={{ opacity: saving === row.car_type ? 0.5 : 1 }}
                  >
                    {/* car_type — immutable PK */}
                    <td style={TD} className="mono">
                      {row.car_type}
                    </td>

                    {/* Label — editable */}
                    <td style={TD}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          autoFocus
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--accent)",
                            borderRadius: "3px",
                            color: "var(--text)",
                            fontSize: "0.85rem",
                            padding: "0.25rem 0.5rem",
                            width: "120px",
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{row.label}</span>
                      )}
                    </td>

                    {/* Priority — editable */}
                    <td style={TD}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--accent)",
                            borderRadius: "3px",
                            color: "var(--text)",
                            fontSize: "0.85rem",
                            padding: "0.25rem 0.5rem",
                            width: "80px",
                          }}
                        />
                      ) : (
                        <span
                          className="mono"
                          style={{ color: "var(--text-dim)" }}
                        >
                          {row.priority}
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
                            onClick={() => saveEdit(row.car_type)}
                            className="btn btn-primary btn-sm"
                            disabled={saving === row.car_type}
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
                        <div
                          style={{
                            display: "flex",
                            gap: "0.4rem",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            onClick={() => openEdit(row)}
                            className="btn btn-secondary btn-sm"
                            disabled={!!saving}
                          >
                            ✏️ Modifier
                          </button>
                          <button
                            onClick={() => deleteLabel(row.car_type)}
                            className="btn btn-danger btn-sm"
                            disabled={!!saving}
                          >
                            Supprimer
                          </button>
                        </div>
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
