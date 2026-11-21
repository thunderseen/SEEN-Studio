// SEEN Studio — Production Cloudflare Pages Functions API (/api/*)
// Permanent cloud database backed by Cloudflare D1 (row-per-item catalog + orders).
// New T-shirts uploaded from Admin Studio and customer orders persist globally across all devices.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Cache-Control': 'no-store',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_items (
      gender TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (gender, sort_order)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS store_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
  ]);
}

async function notifyTelegram(env, order) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    const text = [
      `🛍️ New SEEN Studio Order: ${order.id || 'N/A'}`,
      `Customer: ${order.customer?.name || order.name || 'Guest'} (${order.customer?.phone || order.phone || ''})`,
      `Total: ৳${order.totalBdt ?? order.bdt ?? ''} | Method: ${order.payment?.method || order.method || ''}`,
      order.payment?.trxId ? `TrxID: ${order.payment.trxId}` : '',
    ].filter(Boolean).join('\n');

    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
  } catch (_) {}
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const db = env.DB;

  if (!db) {
    return jsonResponse({
      ok: false,
      error: 'Cloudflare D1 binding "DB" is not configured yet. See DEPLOYMENT-GUIDE.md.',
    }, 503);
  }

  try {
    await ensureSchema(db);

    if (path === '/api/health' && method === 'GET') {
      const ordRow = await db.prepare('SELECT COUNT(*) AS cnt FROM orders').first();
      const catRow = await db.prepare('SELECT COUNT(*) AS cnt FROM catalog_items').first();
      return jsonResponse({
        ok: true,
        mode: 'cloud-d1',
        ordersCount: Number(ordRow?.cnt || 0),
        catalogItemsCount: Number(catRow?.cnt || 0),
        serverTime: new Date().toISOString(),
      });
    }

    if (path === '/api/orders' && method === 'GET') {
      const { results } = await db
        .prepare('SELECT payload FROM orders ORDER BY created_at DESC LIMIT 500')
        .all();
      const orders = (results || []).map((r) => {
        try { return JSON.parse(r.payload); } catch { return null; }
      }).filter(Boolean);
      return jsonResponse(orders);
    }

    if (path === '/api/orders' && method === 'POST') {
      const order = await request.json();
      const id = String(order.id || `SEEN-${Date.now()}`);
      order.id = id;
      const status = String(order.status || 'pending');
      await db.prepare(
        `INSERT OR REPLACE INTO orders (id, status, payload, created_at, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))`
      ).bind(id, status, JSON.stringify(order)).run();

      if (typeof context.waitUntil === 'function') {
        context.waitUntil(notifyTelegram(env, order));
      }

      const row = await db.prepare('SELECT COUNT(*) AS cnt FROM orders').first();
      return jsonResponse({ ok: true, id, totalOrders: Number(row?.cnt || 1) }, 201);
    }

    if (path === '/api/orders/status' && (method === 'POST' || method === 'PATCH')) {
      const patch = await request.json();
      const existing = await db
        .prepare('SELECT payload FROM orders WHERE id = ?1')
        .bind(String(patch.id || ''))
        .first();
      if (!existing) {
        return jsonResponse({ ok: false, error: 'Order not found' }, 404);
      }
      const order = JSON.parse(existing.payload);
      order.status = patch.status;
      await db.prepare(
        `UPDATE orders SET status = ?1, payload = ?2, updated_at = datetime('now') WHERE id = ?3`
      ).bind(String(patch.status || 'pending'), JSON.stringify(order), String(patch.id)).run();
      return jsonResponse({ ok: true });
    }

    if (path === '/api/catalog' && method === 'GET') {
      const { results } = await db
        .prepare('SELECT gender, payload FROM catalog_items ORDER BY gender ASC, sort_order ASC')
        .all();
      if (!results || results.length === 0) {
        return new Response('null', {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
        });
      }
      const catalog = { men: [], women: [] };
      for (const row of results) {
        if (row.gender === 'men' || row.gender === 'women') {
          try { catalog[row.gender].push(JSON.parse(row.payload)); } catch (_) {}
        }
      }
      return jsonResponse(catalog);
    }

    if (path === '/api/catalog' && method === 'POST') {
      const catalog = await request.json();
      if (!catalog || !Array.isArray(catalog.men) || !Array.isArray(catalog.women)) {
        return jsonResponse({ ok: false, error: 'Invalid catalog shape' }, 400);
      }

      // Clear and re-insert each T-shirt as its own D1 row (avoids single-row 1MB D1 limit)
      await db.prepare('DELETE FROM catalog_items').run();

      const insertStmt = db.prepare(
        `INSERT INTO catalog_items (gender, sort_order, item_id, payload, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))`
      );

      for (const gender of ['men', 'women']) {
        const list = catalog[gender];
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const itemId = String(item?.id || `${gender}-${i}`);
          await insertStmt.bind(gender, i, itemId, JSON.stringify(item)).run();
        }
      }

      return jsonResponse({
        ok: true,
        menCount: catalog.men.length,
        womenCount: catalog.women.length,
      });
    }

    if (path === '/api/config' && method === 'GET') {
      const row = await db.prepare("SELECT value FROM store_state WHERE key = 'config'").first();
      const fallback = '{"webhook":"","sslStore":"","waNumber":"8801307758119"}';
      return new Response(row ? row.value : fallback, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
      });
    }

    if (path === '/api/config' && method === 'POST') {
      const bodyText = await request.text();
      JSON.parse(bodyText);
      await db.prepare(
        `INSERT OR REPLACE INTO store_state (key, value, updated_at)
         VALUES ('config', ?1, datetime('now'))`
      ).bind(bodyText).run();
      return jsonResponse({ ok: true });
    }

    // Live SSLCommerz IPN / bKash Callback Webhook Endpoint
    if (path === '/api/webhook/payment' && method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      let payload = {};
      if (contentType.includes('application/json')) {
        payload = await request.json();
      } else {
        const form = await request.formData();
        payload = Object.fromEntries(form.entries());
      }

      const orderId = String(payload.tran_id || payload.order_id || payload.id || '');
      const status = String(payload.status || '').toUpperCase();
      if (orderId && (status === 'VALID' || status === 'VALIDATED' || status === 'COMPLETED')) {
        const existing = await db.prepare('SELECT payload FROM orders WHERE id = ?1').bind(orderId).first();
        if (existing) {
          const order = JSON.parse(existing.payload);
          order.status = 'verified';
          order.gatewayProof = {
            val_id: payload.val_id || null,
            bank_tran_id: payload.bank_tran_id || null,
            verifiedAt: new Date().toISOString(),
          };
          await db.prepare(
            `UPDATE orders SET status = 'verified', payload = ?1, updated_at = datetime('now') WHERE id = ?2`
          ).bind(JSON.stringify(order), orderId).run();
        }
      }
      return jsonResponse({ ok: true, received: true });
    }

    return jsonResponse({ ok: false, error: 'Route not found' }, 404);
  } catch (err) {
    return jsonResponse({ ok: false, error: err?.message || 'Server error' }, 500);
  }
}
