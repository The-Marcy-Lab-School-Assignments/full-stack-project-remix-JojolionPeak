/**
 * controllers/userControllers.js
 *
 * DELETE /api/users/:id — delete the authenticated user's own account
 */

const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");

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
 * Allows a user to update their display name and/or password.
 * Requires current password to authorize any change.
 * Body: { currentPassword, displayName?, newPassword? }
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.id !== id) {
      return res.status(403).json({ error: "Forbidden. You can only edit your own account." });
    }

    const { currentPassword, displayName, newPassword, avatarUrl } = req.body;

    // avatarUrl-only updates don't require a password
    const needsPassword = displayName || newPassword;

    if (needsPassword && !currentPassword) {
      return res.status(400).json({ error: "Current password is required." });
    }

    if (!displayName && !newPassword && avatarUrl === undefined) {
      return res.status(400).json({ error: "Provide a new display name, password, or avatar URL to update." });
    }

    if (needsPassword) {
      // Re-fetch the full user row so we have password_hash
      const user = await userModel.findByEmail(req.user.email);

      if (!user || !user.passwordHash) {
        return res.status(400).json({ error: "Password update is not available for OAuth accounts." });
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect." });
      }
    }

    const updated = await userModel.updateUser(id, {
      displayName: displayName || undefined,
      newPassword: newPassword || undefined,
      avatarUrl,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = { deleteUser, updateUser };