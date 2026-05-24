import { useState } from "react";
import { api } from "../../api/api";

const VALID_TYPES = ["expense", "income", "both"];

const TYPE_LABELS = { expense: "Expense", income: "Income", both: "Both" };

export default function CreateCategoryModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", icon: "", color: "", type: "expense" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Category name is required.");
      return;
    }
    if (!VALID_TYPES.includes(form.type)) {
      setError("Please select a valid type.");
      return;
    }
    if (form.color && !/^#[0-9A-Fa-f]{6}$/.test(form.color)) {
      setError("Color must be a valid hex code (e.g. #FF6B6B).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/categories", {
        name:  form.name.trim(),
        icon:  form.icon.trim() || undefined,
        color: form.color || undefined,
        type:  form.type,
      });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create category.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="eyebrow">New Category</p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <p className="alert-error">{error}</p>}

        <div className="modal-fields">
          <input
            className="input"
            placeholder="Category name *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus
          />

          <input
            className="input"
            placeholder="Icon (emoji, e.g. 🍕)"
            value={form.icon}
            onChange={(e) => set("icon", e.target.value)}
          />

          {/* Colour picker + hex input */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <input
              type="color"
              value={form.color || "#ef4444"}
              onChange={(e) => set("color", e.target.value)}
              style={{
                width: "42px", height: "42px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface)",
                cursor: "pointer",
                padding: "2px",
                flexShrink: 0,
              }}
              title="Pick a colour"
            />
            <input
              className="input"
              placeholder="Hex colour (e.g. #FF6B6B)"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
            />
          </div>

          {/* Type selector */}
          <div>
            <p style={{
              fontSize: "0.65rem", letterSpacing: "0.1em",
              color: "var(--color-text-muted)", textTransform: "uppercase",
              marginBottom: "0.5rem",
            }}>
              Type *
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {VALID_TYPES.map((t) => (
                <button
                  key={t}
                  className="btn"
                  onClick={() => set("type", t)}
                  style={{
                    flex: 1,
                    fontSize: "0.75rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: form.type === t
                      ? (t === "income" ? "#4ade80" : t === "expense" ? "var(--color-error)" : "var(--color-accent)")
                      : "transparent",
                    color: form.type === t ? "#fff" : "var(--color-text-muted)",
                    border: "1px solid",
                    borderColor: form.type === t
                      ? (t === "income" ? "#4ade80" : t === "expense" ? "var(--color-error)" : "var(--color-accent)")
                      : "var(--color-border)",
                  }}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          {form.name.trim() && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: form.color || "var(--color-text-faint)",
              }} />
              <span style={{ fontSize: "1rem" }}>{form.icon || "◈"}</span>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text)" }}>{form.name}</span>
              <span style={{
                marginLeft: "auto",
                fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase",
                color: form.type === "income" ? "#4ade80" : form.type === "expense" ? "#f87171" : "#94a3b8",
              }}>
                {form.type}
              </span>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating…" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}