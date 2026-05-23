/**
 * middleware/authenticate.js
 *
 * 1. Verifies JWT signature and expiry
 * 2. Checks denylist — rejects revoked tokens
 * 3. Attaches decoded payload to req.user
 *
 * Fails closed: if the denylist DB is unavailable, the request is rejected.
 */

const jwt = require("jsonwebtoken");
const denylistModel = require("../models/tokenDenylistModel");

const authenticate = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please sign in." });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      error: "Session expired or invalid. Please sign in again.",
    });
  }

  // Reject old pre-denylist tokens that have no jti
  if (!decoded.jti) {
    return res.status(401).json({
      error: "Session invalid. Please sign in again.",
    });
  }

  try {
    const revoked = await denylistModel.isRevoked(decoded.jti);
    if (revoked) {
      return res.status(401).json({
        error: "Session has been revoked. Please sign in again.",
      });
    }
  } catch (err) {
    console.error("⚠️ Denylist check failed:", err.message);
    return res.status(503).json({
      error: "Authentication service unavailable. Please try again.",
    });
  }

  req.user = decoded;
  next();
};

module.exports = authenticate;