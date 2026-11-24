-- SEEN Studio — Cloudflare D1 Production Schema
-- Stores each T-shirt & each order as its own row (supports hundreds of custom tees on Free 5GB D1)
-- Run once: npx wrangler d1 execute seen-studio-db --remote --file=./cloud/schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS catalog_items (
  gender TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (gender, sort_order)
);

CREATE TABLE IF NOT EXISTS store_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_designs (
  id TEXT PRIMARY KEY,
  creator_name TEXT NOT NULL DEFAULT 'Guest Designer',
  gender TEXT NOT NULL DEFAULT 'men',
  title TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_designs_created_at ON user_designs(created_at DESC);

INSERT OR IGNORE INTO store_state (key, value)
VALUES ('config', '{"webhook":"","sslStore":"","waNumber":"8801307758119"}');
