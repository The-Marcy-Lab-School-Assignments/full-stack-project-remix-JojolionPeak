/**
 * middleware/authenticate.js
 *
 * Verifies the JWT sent as an HttpOnly cookie named 'token'.
 * On success, attaches { id, iat, exp } to req.user.
 * Full profile data is fetched from the DB by controllers that need it
 * (e.g. getMe), keeping the JWT payload — and therefore the cookie — small.
 *
 * On failure, returns 401.
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
    req.user = decoded; // { id, iat, exp }
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Session expired or invalid. Please sign in again." });
  }
};

module.exports = authenticate;