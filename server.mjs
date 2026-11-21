// SEEN Studio — Universal Zero-Dependency Production Node.js Server (v18+)
// Deploy directly to Render, Railway, Fly.io, DigitalOcean, VPS, or cPanel Node.js.
// Start: node server.mjs   (uses PORT and DATA_DIR env vars automatically)

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Cache-Control': 'no-store',
};

async function initDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(ORDERS_FILE); } catch { await fs.writeFile(ORDERS_FILE, '[]', 'utf8'); }
  try { await fs.access(CONFIG_FILE); } catch {
    await fs.writeFile(CONFIG_FILE, '{"webhook":"","sslStore":"","waNumber":"8801307758119"}', 'utf8');
  }
}

function sendJson(res, status, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(body);
}

function readBody(req, limitBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readOrders() {
  try {
    const parsed = JSON.parse(await fs.readFile(ORDERS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

await initDataDir();

const server = http.createServer(async (req, res) => {
  try {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';

    // ---------------- FULL-STACK REST API ----------------
    if (pathname === '/api/health' && method === 'GET') {
      const orders = await readOrders();
      return sendJson(res, 200, {
        ok: true,
        mode: 'cloud-node',
        ordersCount: orders.length,
        serverTime: new Date().toISOString(),
      });
    }

    if (pathname === '/api/orders' && method === 'GET') {
      return sendJson(res, 200, await readOrders());
    }

    if (pathname === '/api/orders' && method === 'POST') {
      const order = JSON.parse(await readBody(req));
      const orders = await readOrders();
      orders.unshift(order);
      await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
      return sendJson(res, 201, { ok: true, id: order.id, totalOrders: orders.length });
    }

    if (pathname === '/api/orders/status' && (method === 'POST' || method === 'PATCH')) {
      const patch = JSON.parse(await readBody(req));
      const orders = await readOrders();
      const target = orders.find((o) => o.id === patch.id);
      if (!target) return sendJson(res, 404, { ok: false, error: 'Order not found' });
      target.status = patch.status;
      await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/catalog' && method === 'GET') {
      try {
        return sendJson(res, 200, await fs.readFile(CATALOG_FILE, 'utf8'));
      } catch {
        return sendJson(res, 200, 'null');
      }
    }

    if (pathname === '/api/catalog' && method === 'POST') {
      const raw = await readBody(req);
      JSON.parse(raw);
      await fs.writeFile(CATALOG_FILE, raw, 'utf8');
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/config' && method === 'GET') {
      return sendJson(res, 200, await fs.readFile(CONFIG_FILE, 'utf8'));
    }

    if (pathname === '/api/config' && method === 'POST') {
      const raw = await readBody(req);
      JSON.parse(raw);
      await fs.writeFile(CONFIG_FILE, raw, 'utf8');
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/webhook/payment' && method === 'POST') {
      const raw = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(raw); } catch {
        payload = Object.fromEntries(new URLSearchParams(raw));
      }
      const orderId = String(payload.tran_id || payload.order_id || payload.id || '');
      const status = String(payload.status || '').toUpperCase();
      if (orderId && (status === 'VALID' || status === 'VALIDATED' || status === 'COMPLETED')) {
        const orders = await readOrders();
        const target = orders.find((o) => o.id === orderId);
        if (target) {
          target.status = 'verified';
          target.gatewayProof = { val_id: payload.val_id || null, verifiedAt: new Date().toISOString() };
          await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        }
      }
      return sendJson(res, 200, { ok: true, received: true });
    }

    // ---------------- STATIC FRONTEND ----------------
    const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const fullPath = path.resolve(__dirname, relPath);
    if (!fullPath.startsWith(__dirname) || fullPath.startsWith(DATA_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const content = await fs.readFile(fullPath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(content);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message || 'Internal Server Error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SEEN Studio Cloud Server listening on http://${HOST}:${PORT} (DATA_DIR: ${DATA_DIR})`);
});
