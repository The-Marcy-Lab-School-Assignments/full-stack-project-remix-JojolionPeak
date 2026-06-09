jest.mock("../models/categoryModel");

const categoryModel = require("../models/categoryModel");

const {
  listCategories,
  createCategory,
  deleteCategory,
} = require("../controllers/categoryControllers");

const makeReq = (overrides = {}) => ({
  user:   { id: "user-1" },
  params: {},
  body:   {},
  ...overrides,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const next = jest.fn();

const fakeCustomCategory = {
  id:       "cat-1",
  userId:   "user-1",
  name:     "Coffee",
  icon:     "☕",
  color:    "#6F4E37",
  type:     "expense",
  isCustom: true,
};

const fakeGlobalCategory = {
  id:       "cat-global-1",
  userId:   null,
  name:     "Food & Dining",
  icon:     "🍔",
  color:    "#FF6B6B",
  type:     "expense",
  isCustom: false,
};

describe("listCategories", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns both global and custom categories for the user", async () => {
    categoryModel.listForUser.mockResolvedValue([fakeGlobalCategory, fakeCustomCategory]);
    const res = makeRes();
    await listCategories(makeReq(), res, next);
    expect(res.json).toHaveBeenCalledWith([fakeGlobalCategory, fakeCustomCategory]);
    expect(categoryModel.listForUser).toHaveBeenCalledWith("user-1");
  });

  test("returns an empty array when user has no categories", async () => {
    categoryModel.listForUser.mockResolvedValue([]);
    const res = makeRes();
    await listCategories(makeReq(), res, next);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe("createCategory", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 400 when name is missing", async () => {
    const res = makeRes();
    await createCategory(makeReq({ body: { type: "expense" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "name and type are required." });
  });

  test("returns 400 when type is missing", async () => {
    const res = makeRes();
    await createCategory(makeReq({ body: { name: "Coffee" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "name and type are required." });
  });

  test("returns 400 when type is invalid", async () => {
    const res = makeRes();
    await createCategory(makeReq({ body: { name: "Coffee", type: "transfer" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "type must be one of: expense, income, both.",
    });
  });

  test("creates category and returns 201 on valid input", async () => {
    categoryModel.create.mockResolvedValue(fakeCustomCategory);
    const res = makeRes();
    await createCategory(makeReq({ body: { name: "Coffee", type: "expense", icon: "☕", color: "#6F4E37" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeCustomCategory);
  });

  test("accepts all three valid types", async () => {
    for (const type of ["expense", "income", "both"]) {
      categoryModel.create.mockResolvedValue({ ...fakeCustomCategory, type });
      const res = makeRes();
      await createCategory(makeReq({ body: { name: "Test", type } }), res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    }
  });
});

describe("deleteCategory", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 404 when category does not exist", async () => {
    categoryModel.findById.mockResolvedValue(null);
    const res = makeRes();
    await deleteCategory(makeReq({ params: { id: "ghost-cat" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Category not found." });
  });

  test("returns 403 when trying to delete a global category", async () => {
    categoryModel.findById.mockResolvedValue(fakeGlobalCategory);
    const res = makeRes();
    await deleteCategory(makeReq({ params: { id: "cat-global-1" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Global categories cannot be deleted." });
  });

  test("returns 403 when category belongs to a different user", async () => {
    categoryModel.findById.mockResolvedValue({ ...fakeCustomCategory, userId: "user-2" });
    const res = makeRes();
    await deleteCategory(makeReq({ params: { id: "cat-1" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden. You can only delete your own categories." });
  });

  test("deletes and returns category when user is the owner", async () => {
    categoryModel.findById.mockResolvedValue(fakeCustomCategory);
    categoryModel.remove.mockResolvedValue(fakeCustomCategory);
    const res = makeRes();
    await deleteCategory(makeReq({ params: { id: "cat-1" } }), res, next);
    expect(categoryModel.remove).toHaveBeenCalledWith("cat-1");
    expect(res.json).toHaveBeenCalledWith(fakeCustomCategory);
  });
});