const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../server");

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, "ok");
});

test("GET /users returns a list of users", async () => {
  const res = await request(app).get("/users");

  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 1);
});

test("GET /users/:id returns 404 for a user that does not exist", async () => {
  const res = await request(app).get("/users/9999");

  assert.strictEqual(res.status, 404);
});

test("POST /users with no body returns 400", async () => {
  const res = await request(app).post("/users").send({});

  assert.strictEqual(res.status, 400);
});

test("GET /users?q= finds a user by name", async () => {
  const res = await request(app).get("/users").query({ q: "lovelace" });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.map((user) => user.id),
    [1]
  );
});

test("GET /users?q= finds a user by email", async () => {
  const res = await request(app).get("/users").query({ q: "alan@" });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.map((user) => user.id),
    [2]
  );
});

test("GET /users?q= ignores case and surrounding spaces", async () => {
  const res = await request(app).get("/users").query({ q: "  ADA  " });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.map((user) => user.id),
    [1]
  );
});

test("GET /users?q= returns an empty list when nothing matches", async () => {
  const res = await request(app).get("/users").query({ q: "zzz" });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test("GET /users?q= returns 400 for an empty search", async () => {
  const empty = await request(app).get("/users?q=");
  const spaces = await request(app).get("/users?q=%20");

  assert.strictEqual(empty.status, 400);
  assert.strictEqual(spaces.status, 400);
  assert.ok(empty.body.error);
});

test("GET /users?q= returns 400 for a repeated param", async () => {
  const res = await request(app).get("/users?q=a&q=b");

  assert.strictEqual(res.status, 400);
  assert.ok(res.body.error);
});

test("POST /users rejects a non-string name or email and stores nothing", async () => {
  const before = await request(app).get("/users");

  const badName = await request(app)
    .post("/users")
    .send({ name: 12345, email: "valid@example.com" });
  const badEmail = await request(app)
    .post("/users")
    .send({ name: "Valid Name", email: true });

  const after = await request(app).get("/users");

  assert.strictEqual(badName.status, 400);
  assert.strictEqual(badEmail.status, 400);
  assert.ok(badName.body.error);
  assert.ok(badEmail.body.error);
  assert.strictEqual(after.body.length, before.body.length);
});

test("POST /users creates a user that search can find", async () => {
  const created = await request(app)
    .post("/users")
    .send({ name: "Grace Hopper", email: "grace@example.com" });
  assert.strictEqual(created.status, 201);

  const res = await request(app).get("/users").query({ q: "hopper" });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.map((user) => user.id),
    [created.body.id]
  );
});

test("GET /users without pagination params returns a plain array and no paging headers", async () => {
  const res = await request(app).get("/users");

  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.strictEqual(res.headers["x-total-count"], undefined);
  assert.strictEqual(res.headers["x-limit"], undefined);
});

test("GET /users?limit= returns the first page with paging headers", async () => {
  const all = await request(app).get("/users");
  const res = await request(app).get("/users?limit=2");

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, all.body.slice(0, 2));
  assert.strictEqual(res.headers["x-total-count"], String(all.body.length));
  assert.strictEqual(res.headers["x-limit"], "2");
});

test("GET /users?limit=&offset= returns the next page", async () => {
  const all = await request(app).get("/users");
  const res = await request(app).get("/users?limit=1&offset=1");

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, all.body.slice(1, 2));
});

test("GET /users?offset= alone uses the default limit", async () => {
  const all = await request(app).get("/users");
  const res = await request(app).get("/users?offset=1");

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, all.body.slice(1, 21));
  assert.strictEqual(res.headers["x-limit"], "20");
});

test("GET /users with an offset past the end returns an empty page and the total", async () => {
  const all = await request(app).get("/users");
  const res = await request(app).get("/users?offset=9999");

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
  assert.strictEqual(res.headers["x-total-count"], String(all.body.length));
});

test("GET /users returns 400 for invalid limit or offset values", async () => {
  const badQueries = [
    "limit=0",
    "limit=abc",
    "limit=-1",
    "limit=1.5",
    "limit=1e3",
    "limit=",
    "limit=1&limit=2",
    "offset=abc",
    "offset=-1",
    "offset=1.5",
    "offset=",
    "offset=1&offset=2",
  ];

  for (const query of badQueries) {
    const res = await request(app).get(`/users?${query}`);

    assert.strictEqual(res.status, 400, query);
    assert.ok(res.body.error, query);
  }
});

test("GET /users?q=&limit= paginates the matches and counts only matches", async () => {
  const matches = await request(app).get("/users").query({ q: "a" });
  const res = await request(app).get("/users").query({ q: "a", limit: 1 });
  const none = await request(app).get("/users").query({ q: "zzz", limit: 1 });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, matches.body.slice(0, 1));
  assert.strictEqual(res.headers["x-total-count"], String(matches.body.length));
  assert.strictEqual(none.headers["x-total-count"], "0");
});

test("GET /users caps an oversized limit at 100", async () => {
  for (let i = 0; i < 101; i += 1) {
    await request(app)
      .post("/users")
      .send({ name: `Bulk User ${i}`, email: `bulk${i}@example.com` });
  }
  const all = await request(app).get("/users");

  for (const limit of ["101", "99999999999999999999"]) {
    const res = await request(app).get(`/users?limit=${limit}`);

    assert.strictEqual(res.status, 200, limit);
    assert.strictEqual(res.body.length, 100, limit);
    assert.strictEqual(res.headers["x-limit"], "100", limit);
    assert.strictEqual(res.headers["x-total-count"], String(all.body.length));
  }
});
