/**
 * controllers/categoryControllers.js
 *
 * GET    /api/categories      — list global + user's custom categories
 * POST   /api/categories      — create a custom category
 * DELETE /api/categories/:id  — delete a user's custom category
 */

const categoryModel = require("../models/categoryModel");

const VALID_TYPES = ["expense", "income", "both"];

/**
 * GET /api/categories
 * Returns global defaults + the authenticated user's custom categories.
 */
const listCategories = async (req, res, next) => {
  try {
    const categories = await categoryModel.listForUser(req.user.id);
    res.json(categories);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/categories
 * Creates a custom category owned by the authenticated user.
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, icon, color, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "name and type are required." });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${VALID_TYPES.join(", ")}.`,
      });
    }

    const category = await categoryModel.create(req.user.id, {
      name,
      icon,
      color,
      type,
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/categories/:id
 * Deletes a user-created category.
 * Global defaults (user_id IS NULL) cannot be deleted.
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await categoryModel.findById(id);

    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }

    // Global defaults have userId = null — protect them from deletion
    if (!category.userId) {
      return res
        .status(403)
        .json({ error: "Global categories cannot be deleted." });
    }

    // Users can only delete their own custom categories
    if (category.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden. You can only delete your own categories." });
    }

    const deleted = await categoryModel.remove(id);
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

module.exports = { listCategories, createCategory, deleteCategory };
