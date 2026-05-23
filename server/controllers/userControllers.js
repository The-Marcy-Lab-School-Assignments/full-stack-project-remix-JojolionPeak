/**
 * controllers/userControllers.js
 */

const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const denylistModel = require("../models/tokenDenylistModel");

const validateAvatarUrl = (url) => {
  if (url === null || url === "" || url === undefined) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.id !== id) {
      return res.status(403).json({
        error: "Forbidden. You can only delete your own account.",
      });
    }

    const deleted = await userModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ error: "User not found." });
    }

    // Revoke the current token immediately so it can't be reused
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.jti && decoded?.exp) {
          await denylistModel.add(decoded.jti, decoded.exp);
        }
      } catch (err) {
        console.error(
          "⚠️ Failed to denylist token on account deletion:",
          err.message
        );
      }
    }

    res.clearCookie("token", { httpOnly: true, sameSite: "strict" });
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

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
        return res.status(400).json({ error: "New password must be 128 characters or fewer." });
      }
    }

    if (avatarUrl !== undefined && !validateAvatarUrl(avatarUrl)) {
      return res.status(400).json({ error: "Avatar URL must be a valid https:// URL." });
    }

    const userById = await userModel.findById(id);
    if (!userById) {
      return res.status(404).json({ error: "User not found." });
    }
    const user = await userModel.findByEmail(userById.email);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isOAuthUser = !user.passwordHash;

    if (newPassword && isOAuthUser) {
      return res.status(400).json({ error: "Password update is not available for OAuth accounts." });
    }

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