/**
 * controllers/userControllers.js
 *
 * DELETE /api/users/:id — delete the authenticated user's own account
 * PATCH  /api/users/:id — update display name, password, and/or avatar URL
 */

const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates that avatarUrl is either empty/null (clearing the avatar)
 * or a well-formed https:// URL. Rejects javascript: and data: URIs,
 * plain HTTP, and anything that isn't a URL at all.
 */
const validateAvatarUrl = (url) => {
  if (url === null || url === "" || url === undefined) return true; // clearing is fine
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * DELETE /api/users/:id
 * Auth required. Users may only delete their own account.
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 403 — cannot delete someone else's account
    if (req.user.id !== id) {
      return res
        .status(403)
        .json({ error: "Forbidden. You can only delete your own account." });
    }

    const deleted = await userModel.remove(id);

    // 404 — account was already gone (race condition, etc.)
    if (!deleted) {
      return res.status(404).json({ error: "User not found." });
    }

    // Clear the JWT cookie — the account no longer exists
    res.clearCookie("token", { httpOnly: true, sameSite: "strict" });

    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id
 * Allows a user to update their display name, password, and/or avatar URL.
 * Local users require their current password to change display name or password.
 * OAuth users can update display name and avatar URL without a password.
 * Body: { currentPassword?, displayName?, newPassword?, avatarUrl? }
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.id !== id) {
      return res.status(403).json({ error: "Forbidden. You can only edit your own account." });
    }

    const { currentPassword, displayName, newPassword, avatarUrl } = req.body;

    if (!displayName && !newPassword && avatarUrl === undefined) {
      return res.status(400).json({ error: "Provide a new display name, password, or avatar URL to update." });
    }

    // ── Input validation ──────────────────────────────────────────────────────

    if (displayName !== undefined) {
      if (typeof displayName !== "string" || displayName.trim().length === 0) {
        return res.status(400).json({ error: "Display name cannot be blank." });
      }
      if (displayName.length > 100) {
        return res.status(400).json({ error: "Display name must be 100 characters or fewer." });
      }
    }

    if (newPassword !== undefined) {
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters." });
      }
      if (newPassword.length > 128) {
        // Prevents bcrypt CPU-DoS via huge strings
        return res.status(400).json({ error: "New password must be 128 characters or fewer." });
      }
    }

    if (avatarUrl !== undefined && !validateAvatarUrl(avatarUrl)) {
      return res.status(400).json({ error: "Avatar URL must be a valid https:// URL." });
    }

    // ── Re-fetch user ─────────────────────────────────────────────────────────
    // The JWT only carries { id }, so we look up by id first, then use the
    // returned email to get the full row including passwordHash for bcrypt.

    const userById = await userModel.findById(id);
    if (!userById) {
      return res.status(404).json({ error: "User not found." });
    }
    const user = await userModel.findByEmail(userById.email);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isOAuthUser = !user.passwordHash;

    // Password changes are never allowed for OAuth users
    if (newPassword && isOAuthUser) {
      return res.status(400).json({ error: "Password update is not available for OAuth accounts." });
    }

    // Local users must supply their current password to change display name or password
    const needsPassword = !isOAuthUser && (displayName || newPassword);

    if (needsPassword && !currentPassword) {
      return res.status(400).json({ error: "Current password is required." });
    }

    if (needsPassword) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect." });
      }
    }

    const updated = await userModel.updateUser(id, {
      displayName: displayName ? displayName.trim() : undefined,
      newPassword: newPassword || undefined,
      avatarUrl,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = { deleteUser, updateUser };