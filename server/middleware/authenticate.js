/**
 * middleware/authenticate.js
 *
 * Verifies the JWT sent as an HttpOnly cookie named 'token'.
 * On success, attaches the decoded payload to req.user:
 *   req.user = { id, email, displayName, avatarUrl }
 *
 * On failure, returns 401. Controllers never need to check auth themselves —
 * just apply this middleware to any route that requires a logged-in user.
 */

const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ error: "Not authenticated. Please sign in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, displayName, avatarUrl, iat, exp }
    next();
  } catch (err) {
    // Catches expired tokens, tampered signatures, etc.
    return res
      .status(401)
      .json({ error: "Session expired or invalid. Please sign in again." });
  }
};

module.exports = authenticate;
