const jwt = require("jsonwebtoken");

// Protects file routes. Expects "Authorization: Bearer <token>".
// This is deliberately simple (single admin user, see routes/auth.js) so the
// project is easy to run locally. Swap this out for AWS Cognito or a real
// user database before putting this in front of real users.
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { username }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = authenticate;
