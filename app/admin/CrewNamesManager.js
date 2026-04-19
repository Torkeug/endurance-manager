"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../lib/supabase-browser";

// Returns true when a hex color is mid-range enough to be legible as text
// on both a light and a dark background (mirrors the logic in EventPageTabs CrewPill).
function isSafeTextColor(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toLinear = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.08 && lum < 0.7;
}

// Default palette offered as quick-pick swatches in the color form.
// Same hues as the hash-based fallback in CrewPill — keeps the two systems visually consistent.
const PALETTE_PRESETS = [
  "#000000", // black
  "#c9a84c", // gold
  "#808080", // grey
  "#ffffff", // white
  "#0774eb", // blue
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
];

export default function CrewNamesManager({ initialCrewNames }) {
  const router = useRouter();
  const [items, setItems] = useState(initialCrewNames);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");
  // Color defaults to null (no color set) — hash fallback will be used in pills
  const [newColor, setNewColor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setNewName("");
    setNewColor(null);
    setError(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("crew_names")
      .insert([{
        name: newName.trim(),
        color: newColor || null,
        sort_order: (items.length + 1) * 10,
      }])
      .select()
      .single();
    if (err) {
      // 23505 = unique constraint violation — name already exists
      if (err.code === "23505") {
        setError("Ce nom existe déjà.");
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }
    setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleEdit = async () => {
    if (!newName.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("crew_names")
      .update({ name: newName.trim(), color: newColor || null })
      .eq("id", editingId)
      .select()
      .single();
    if (err) {
      // 23505 = unique constraint violation — name already exists
      if (err.code === "23505") {
        setError("Ce nom existe déjà.");
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === editingId ? data : i)));
    reset();
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce nom d'équipage ?")) return;
    const { error: err } = await supabase.from("crew_names").delete().eq("id", id);
    if (err) {
      // 23503 = FK violation — crew name is referenced by a team entry
      if (err.code === "23503") {
        setError("Ce nom est utilisé par un ou plusieurs équipages et ne peut pas être supprimé.");
      } else {
        setError(err.message);
      }
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setNewName(item.name);
    setNewColor(item.color || null);
    setAdding(false);
    setError(null);
  };

  // Color picker section — native color input + preset swatches + clear button
  const colorPicker = (
    <div className="form-group" style={{ marginTop: "0.75rem" }}>
      <label>Couleur de l&apos;équipage</label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        {/* Native color wheel */}
        <input
          type="color"
          value={newColor || "#6366f1"}
          onChange={(e) => setNewColor(e.target.value)}
          style={{ width: "36px", height: "36px", padding: "2px", cursor: "pointer", borderRadius: "3px", border: "1px solid var(--border)" }}
        />
        {/* Quick-pick palette swatches */}
        {PALETTE_PRESETS.map((hex) => (
          <button
            key={hex}
            onClick={() => setNewColor(hex)}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "3px",
              background: hex,
              border: newColor === hex ? "2px solid var(--text)" : "2px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
            title={hex}
          />
        ))}
        {/* Clear — reverts to automatic hash-based color */}
        {newColor && (
          <button
            onClick={() => setNewColor(null)}
            className="btn btn-secondary btn-sm"
          >
            Effacer
          </button>
        )}
        {/* Live preview of the pill — uses same luminance logic as CrewPill */}
        {newName.trim() && newColor && (
          <span
            style={{
              padding: "0.15rem 0.5rem",
              borderRadius: "3px",
              background: `${newColor}20`,
              border: `1px solid ${newColor}`,
              color: isSafeTextColor(newColor) ? newColor : "var(--text)",
              fontSize: "0.82rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {newName.trim()}
          </span>
        )}
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.35rem" }}>
        Si aucune couleur n&apos;est définie, une couleur automatique est attribuée.
      </div>
    </div>
  );

  const editForm = (
    <div style={{ padding: "1rem", background: "var(--surface-2)", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>{editingId ? "Nom" : "Nouveau nom d'équipage"}</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ex : Kronos Platinum"
          />
        </div>
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
      {colorPicker}
      {error && (
        <div className="alert alert-error" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {!adding && !editingId && error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {adding && editForm}

      {!adding && !editingId && (
        <button
          onClick={() => setAdding(true)}
          className="btn btn-primary"
          style={{ marginBottom: "0.75rem" }}
        >
          + Ajouter un nom d&apos;équipage
        </button>
      )}

      <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
        <table>
          <thead>
            <tr>
              <th>Nom d&apos;équipage</th>
              <th>Couleur</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <React.Fragment key={item.id}>
                <tr>
                  <td style={{ fontWeight: 600 }}>
                    {/* Show pill preview if color is set */}
                    {item.color ? (
                      <span
                        style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: "3px",
                          background: `${item.color}20`,
                          border: `1px solid ${item.color}`,
                          color: isSafeTextColor(item.color) ? item.color : "var(--text)",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                        }}
                      >
                        {item.name}
                      </span>
                    ) : (
                      item.name
                    )}
                  </td>
                  <td>
                    {item.color ? (
                      /* Color dot with hex value */
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "2px",
                            background: item.color,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span className="mono" style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                          {item.color}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                        Auto
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => startEdit(item)}
                        className="btn btn-secondary btn-sm"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr>
                    <td colSpan={3}>{editForm}</td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  Aucun nom d&apos;équipage.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}