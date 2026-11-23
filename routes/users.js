const express = require("express");
const store = require("../db/store");

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Repeated or nested params (?q=a&q=b) arrive as arrays or objects, so these
// checks also confirm the value is a single string.
function isDigits(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}

// GET /users — list users, optionally filtered with ?q=term (name or email)
// and paginated with ?limit=n&offset=n. Pagination is opt-in: with neither
// param, every match is returned.
router.get("/", (req, res) => {
  const { q, limit, offset } = req.query;

  if (q !== undefined && (typeof q !== "string" || q.trim() === "")) {
    return res.status(400).json({ error: "q must be a non-empty string" });
  }

  if (limit !== undefined && (!isDigits(limit) || Number(limit) === 0)) {
    return res.status(400).json({ error: "limit must be a positive integer" });
  }

  if (offset !== undefined && !isDigits(offset)) {
    return res
      .status(400)
      .json({ error: "offset must be a non-negative integer" });
  }

  const query = q && q.trim();

  if (limit === undefined && offset === undefined) {
    return res.json(store.findUsers({ query }).users);
  }

  // Oversized limits are capped; X-Limit tells the client what was applied
  const appliedLimit = Math.min(
    limit === undefined ? DEFAULT_LIMIT : Number(limit),
    MAX_LIMIT
  );
  const { users, total } = store.findUsers({
    query,
    limit: appliedLimit,
    offset: offset === undefined ? 0 : Number(offset),
  });

  res.set("X-Total-Count", String(total));
  res.set("X-Limit", String(appliedLimit));
  res.json(users);
});

// GET /users/:id — fetch a single user, or 404 if it doesn't exist
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const user = store.getUserById(id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

// POST /users — create a user; name and email are required
router.post("/", (req, res) => {
  const { name, email } = req.body;

  if (!name || !email || typeof name !== "string" || typeof email !== "string") {
    return res
      .status(400)
      .json({ error: "name and email are required and must be strings" });
  }

  const user = store.createUser({ name, email });
  res.status(201).json(user);
});

module.exports = router;
