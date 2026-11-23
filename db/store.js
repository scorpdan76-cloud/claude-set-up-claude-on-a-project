// A tiny in-memory data store. It stands in for a real database so the
// project stays easy to run. Data is not persisted — it resets every time
// the server restarts.

let users = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
  { id: 2, name: "Alan Turing", email: "alan@example.com" },
];

let nextId = 3;

function getAllUsers() {
  return users;
}

function getUserById(id) {
  return users.find((user) => user.id === id);
}

// Optionally filters by a case-insensitive partial match on name or email,
// then returns one page of the results plus the total number of matches.
function findUsers({ query, limit = Infinity, offset = 0 } = {}) {
  let matches = users;

  if (query) {
    const term = query.toLowerCase();
    matches = users.filter(
      (user) =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
    );
  }

  return {
    users: matches.slice(offset, offset + limit),
    total: matches.length,
  };
}

function createUser({ name, email }) {
  const user = { id: nextId, name, email };
  nextId += 1;
  users.push(user);
  return user;
}

module.exports = { getAllUsers, getUserById, findUsers, createUser };
