import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/api";

export default function EscMenu({ user, onClose, onLogout, onUserUpdated }) {
  const navigate = useNavigate();
  const [section, setSection] = useState("idle");

  const [displayName, setDisplayName]         = useState(user?.displayName || "");
  const [avatarUrl, setAvatarUrl]             = useState(user?.avatarUrl || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [updateError, setUpdateError]         = useState("");
  const [updateSuccess, setUpdateSuccess]     = useState("");
  const [updateLoading, setUpdateLoading]     = useState(false);

  const [deleteError, setDeleteError]     = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isOAuthUser = user?.isOAuthUser === true;

  const resetUpdateForm = () => {
    setDisplayName(user?.displayName || "");
    setAvatarUrl(user?.avatarUrl || "");
    setCurrentPassword("");
    setNewPassword("");
    setUpdateError("");
    setUpdateSuccess("");
  };

  const handleSectionToggle = (name) => {
    resetUpdateForm();
    setDeleteError("");
    setSection(section === name ? "idle" : name);
  };

  const handleUpdate = async () => {
    setUpdateError("");
    setUpdateSuccess("");

    const nameChanged   = displayName && displayName !== user.displayName;
    const passwordChange = !isOAuthUser && newPassword;
    const avatarChanged  = avatarUrl !== user.avatarUrl;

    if (!nameChanged && !passwordChange && !avatarChanged) {
      setUpdateError("No changes to save.");
      return;
    }

    // Password required only for local users changing name or password
    if (!isOAuthUser && (nameChanged || passwordChange) && !currentPassword) {
      setUpdateError("Current password is required.");
      return;
    }

    setUpdateLoading(true);
    try {
      const res = await api.patch(`/api/users/${user.id}`, {
        currentPassword: (!isOAuthUser && currentPassword) ? currentPassword : undefined,
        displayName: nameChanged ? displayName : undefined,
        newPassword: passwordChange ? newPassword : undefined,
        avatarUrl: avatarChanged ? avatarUrl : undefined,
      });
      setUpdateSuccess("Profile updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      onUserUpdated(res.data);
    } catch (err) {
      setUpdateError(err.response?.data?.error || "Update failed.");
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await api.delete(`/api/users/${user.id}`);
      navigate("/auth", { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Failed to delete account.");
      setDeleteLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: "480px", padding: "1.75rem", gap: "0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: "1.5rem" }}>
          <p className="eyebrow">Menu</p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.65rem", color: "var(--color-text-faint)", letterSpacing: "0.1em" }}>
              ESC to close
            </span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Update Profile ── */}
        <div className="esc-section">
          <button className="esc-section-toggle" onClick={() => handleSectionToggle("update")}>
            <span>✎ &nbsp;Update Profile</span>
            <span className="esc-chevron">{section === "update" ? "▲" : "▼"}</span>
          </button>

          {section === "update" && (
            <div className="esc-section-body">
              {updateError   && <p className="alert-error">{updateError}</p>}
              {updateSuccess && <p className="alert-success">{updateSuccess}</p>}

              {/* Avatar preview + URL input */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ flexShrink: 0 }}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      style={{
                        width: "52px", height: "52px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid var(--color-border-hover)",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div style={{
                    width: "52px", height: "52px",
                    borderRadius: "var(--radius-full)",
                    border: "1px solid var(--color-border-hover)",
                    background: "var(--color-accent-dim)",
                    color: "var(--color-accent)",
                    display: avatarUrl ? "none" : "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: "1.1rem",
                  }}>
                    {(user?.displayName?.[0] || "?").toUpperCase()}
                  </div>
                </div>
                <input
                  className="input"
                  placeholder="Avatar URL"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>

              {/* Display name — available to all users */}
              <input
                className="input"
                placeholder="New display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />

              {/* Password fields — hidden for Google/OAuth users */}
              {!isOAuthUser && (
                <>
                  <input
                    className="input"
                    type="password"
                    placeholder="New password (leave blank to keep current)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Current password *"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                  />
                </>
              )}

              {isOAuthUser && (
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
                  Signed in with Google — password changes are not available.
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={handleUpdate} disabled={updateLoading}>
                  {updateLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Log Out ── */}
        <div className="esc-section">
          <button className="esc-section-toggle" onClick={onLogout}>
            <span>⎋ &nbsp;Log Out</span>
            <span className="esc-chevron">→</span>
          </button>
        </div>

        {/* ── Delete Account ── */}
        <div className="esc-section" style={{ borderBottom: "none" }}>
          <button
            className="esc-section-toggle"
            style={{ color: "var(--color-error)" }}
            onClick={() => handleSectionToggle("delete-1")}
          >
            <span>⚠ &nbsp;Delete Account</span>
            <span className="esc-chevron">{section.startsWith("delete") ? "▲" : "▼"}</span>
          </button>

          {section === "delete-1" && (
            <div className="esc-section-body">
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", lineHeight: "1.5" }}>
                This will permanently delete your account and all associated data. This cannot be undone.
              </p>
              {deleteError && <p className="alert-error">{deleteError}</p>}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setSection("idle")}>Cancel</button>
                <button
                  className="btn"
                  style={{ background: "var(--color-error)", color: "#fff" }}
                  onClick={() => setSection("delete-2")}
                >
                  I understand, continue
                </button>
              </div>
            </div>
          )}

          {section === "delete-2" && (
            <div className="esc-section-body">
              <p style={{ fontSize: "0.85rem", color: "var(--color-error)", lineHeight: "1.5", fontWeight: 500 }}>
                Are you absolutely sure? There is no way to recover your data after deletion.
              </p>
              {deleteError && <p className="alert-error">{deleteError}</p>}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setSection("idle")}>Cancel</button>
                <button
                  className="btn"
                  style={{ background: "var(--color-error)", color: "#fff" }}
                  onClick={handleDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Delete My Account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}