/**
 * controllers/userControllers.js
 *
 * DELETE /api/users/:id — delete the authenticated user's own account
 */

const userModel = require("../models/userModel");

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

module.exports = { deleteUser };
