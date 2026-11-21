-- SEEN Studio — Cloudflare D1 / SQLite Production Schema
-- Run once after creating D1 database:
--   npx wrangler d1 execute seen-studio-db --remote --file=./cloud/schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS store_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO store_state (key, value)
VALUES ('config', '{"webhook":"","sslStore":"","waNumber":"8801307758119"}');
