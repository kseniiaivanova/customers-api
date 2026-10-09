const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: "labdb",
  user: "labadmin",
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const app = express();
app.use(cors({ origin: ["http://localhost:5173","https://main.d26izn6e4w196x.amplifyapp.com"] }));
app.use(express.json());

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: `id must be a positive integer, got "${req.params.id}"` });
    return null;
  }
  return id;
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/customers", async (req, res) => {
  let limit = null;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({ error: `limit must be a positive integer, got "${req.query.limit}"` });
    }
  }
  const { rows } = await pool.query(
    "SELECT id, name, created_at FROM customers ORDER BY id LIMIT $1",
    [limit]
  );
  res.json(rows);
});

app.get("/customers/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const { rows } = await pool.query(
    "SELECT id, name, created_at FROM customers WHERE id = $1",
    [id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: `customer ${id} not found` });
  }
  res.json(rows[0]);
});

app.post("/customers", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  const { rows } = await pool.query(
    "INSERT INTO customers (name) VALUES ($1) RETURNING id, name, created_at",
    [name]
  );
  res.status(201).location(`/customers/${rows[0].id}`).json(rows[0]);
});

app.put("/customers/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  const { rows } = await pool.query(
    "UPDATE customers SET name = $1 WHERE id = $2 RETURNING id, name, created_at",
    [name, id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: `customer ${id} not found` });
  }
  res.json(rows[0]);
});

app.patch("/customers/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const name = req.body?.name;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }
  const { rows } = await pool.query(
    "UPDATE customers SET name = COALESCE($1, name) WHERE id = $2 RETURNING id, name, created_at",
    [name?.trim() ?? null, id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: `customer ${id} not found` });
  }
  res.json(rows[0]);
});

app.delete("/customers/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const { rowCount } = await pool.query(
    "DELETE FROM customers WHERE id = $1",
    [id]
  );
  if (rowCount === 0) {
    return res.status(404).json({ error: `customer ${id} not found` });
  }
  res.status(204).end();
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "body is not valid JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

app.listen(3000, () => console.log("API lyssnar på port 3000"));
[ec2-user@ip-10-0-7-252 ~]$ 