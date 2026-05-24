import { useState, useEffect, useCallback } from "react";
import BackgroundVideo from "../components/BackgroundVideo";
import { api } from "../api/api";
import CreateCategoryModal from "../components/dashboard/CreateCategoryModal";
import { useDelayedNavigate } from "../hooks/useDelayedNavigate";


export default function CategoriesPage() {
  const delayedNavigate = useDelayedNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);   // id pending confirmation
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/api/categories");
      setCategories(res.data);
    } catch {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await api.delete(`/api/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Failed to delete category.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const global = categories.filter((c) => !c.isCustom);
  const custom  = categories.filter((c) => c.isCustom);

  return (
    <div className="page">
      <BackgroundVideo />

      <div className="page-content">
        <header className="dashboard-header animate-fade-down">
          <div>
            <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>Settings</p>
            <h1 className="header-greeting">Categories</h1>
          </div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: "0.75rem", alignSelf: "flex-start", marginTop: "0.4rem" }}
            onClick={() => delayedNavigate("/dashboard")}
          >
            ← Dashboard
          </button>
        </header>

        <main className="dashboard-main">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[1, 0.7, 0.4].map((opacity, i) => (
                <div key={i} className="skeleton" style={{ height: "52px", opacity }} />
              ))}
            </div>
          ) : error ? (
            <p className="alert-error">{error}</p>
          ) : (
            <>
              {/* ── Custom Categories ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <p className="eyebrow">Your Custom Categories</p>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "0.75rem", padding: "0.55rem 1rem" }}
                  onClick={() => setShowCreate(true)}
                >
                  + Create Category
                </button>
              </div>

              {custom.length === 0 ? (
                <div className="empty-state" style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "var(--color-text-faint)",
                  fontSize: "0.8rem",
                  border: "1px dashed var(--color-border-hover)",
                  borderRadius: "var(--radius-lg)",
                  marginBottom: "2rem",
                }}>
                  No custom categories yet — create one above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
                  {custom.map((cat, i) => (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      index={i}
                      isDeleting={deletingId === cat.id}
                      deleteLoading={deleteLoading}
                      deleteError={deleteError}
                      onDeleteRequest={() => { setDeletingId(cat.id); setDeleteError(""); }}
                      onDeleteConfirm={() => handleDelete(cat.id)}
                      onDeleteCancel={() => { setDeletingId(null); setDeleteError(""); }}
                    />
                  ))}
                </div>
              )}

              {/* ── Global Categories ── */}
              <p className="eyebrow" style={{ marginBottom: "1rem" }}>Global Defaults</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {global.map((cat, i) => (
                  <CategoryRow key={cat.id} cat={cat} index={i} readOnly />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {showCreate && (
        <CreateCategoryModal
          onClose={() => setShowCreate(false)}
          onCreated={(newCat) => {
            setCategories((prev) => [newCat, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      <footer style={{
        position: "fixed",
        bottom: "1.5rem",
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: "0.65rem",
        letterSpacing: "0.08em",
        zIndex: 20,
        pointerEvents: "none",
      }}>
        © <span style={{ color: "var(--color-accent)" }}>Mementos</span>{" "}
        <span style={{ color: "var(--color-text)" }}>2026</span>
      </footer>
    </div>
  );
}

// ─── CategoryRow ──────────────────────────────────────────────────────────────

function CategoryRow({
  cat, index, readOnly = false,
  isDeleting, deleteLoading, deleteError,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}) {
  const typeColor = cat.type === "income" ? "#4ade80" : cat.type === "expense" ? "#f87171" : "#94a3b8";

  return (
    <div
      style={{
        opacity: 0,
        animation: `slideUp 0.35s ${index * 40}ms ease forwards`,
      }}
    >
      <div
        className="surface"
        style={{
          padding: "0.75rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: isDeleting ? "0.75rem" : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Colour swatch */}
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: cat.color || "var(--color-text-faint)",
            flexShrink: 0,
          }} />

          {/* Icon */}
          <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>
            {cat.icon || "◈"}
          </span>

          {/* Name */}
          <span style={{ flex: 1, fontSize: "0.9rem", color: "var(--color-text)" }}>
            {cat.name}
          </span>

          {/* Type badge */}
          <span style={{
            fontSize: "0.6rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: typeColor,
            background: `${typeColor}18`,
            padding: "0.2rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            flexShrink: 0,
          }}>
            {cat.type}
          </span>

          {/* Delete trigger (custom only) */}
          {!readOnly && !isDeleting && (
            <button
              onClick={onDeleteRequest}
              style={{
                background: "none", border: "none",
                color: "var(--color-text-faint)",
                cursor: "pointer", fontSize: "0.75rem",
                padding: "0.2rem 0.3rem", lineHeight: 1,
                transition: "color var(--transition)",
                flexShrink: 0,
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--color-error)")}
              onMouseOut={(e)  => (e.currentTarget.style.color = "var(--color-text-faint)")}
              title="Delete category"
            >
              ✕
            </button>
          )}
        </div>

        {/* Inline delete confirmation */}
        {isDeleting && (
          <div style={{
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", margin: 0 }}>
              Delete <strong>{cat.name}</strong>? Transactions using it will be unlinked.
            </p>
            {deleteError && <p className="alert-error" style={{ margin: 0 }}>{deleteError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.45rem 0.9rem" }}
                onClick={onDeleteCancel}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: "var(--color-error)", color: "#fff", fontSize: "0.75rem", padding: "0.45rem 0.9rem" }}
                onClick={onDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}