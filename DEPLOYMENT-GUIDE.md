# SEEN Studio — Live Cloudflare Pages + D1 Deployment & Custom Domain Guide

**SEEN Studio** is deployed live on **Cloudflare Pages** with a permanent **Cloudflare D1 SQL Database** (APAC / Singapore region — free 5 GB tier).

- **Live Cloud Storefront (Free HTTPS Subdomain):** https://seen-studio-store.pages.dev/
- **Cloud Database:** Cloudflare D1 `seen-studio-db` (`cae972b0-adb1-40f8-a6af-38176682aadb`)
- **Live API Health Endpoint:** https://seen-studio-store.pages.dev/api/health
- **Payment Webhook Endpoint (SSLCommerz IPN / bKash Callback):** https://seen-studio-store.pages.dev/api/webhook/payment

---

## Architecture Deployed
- `functions/api/[[route]].js` — Full REST API (`/api/health`, `/api/catalog`, `/api/orders`, `/api/orders/status`, `/api/config`, `/api/webhook/payment`) storing every T-shirt and every order as its own row in D1.
- `functions/_middleware.js` — Blocks public downloads of internal server scripts, configs, and docs (`404`).
- `cloud/schema.sql` — Permanent D1 SQL schema (`orders`, `catalog_items`, `store_state`).
- `wrangler.toml` — Cloudflare Pages + D1 configuration (`seen-studio-store`).

---

## Re-deploy Future Updates (1 Command)
```powershell
npx wrangler pages deploy . --project-name seen-studio-store --branch main
```

---

## Connect Your Own Custom Domain Later (5 Minutes, Free Auto-SSL)
1. Buy your domain (e.g. `seenstudio.com`) via **Cloudflare Registrar**, **Namecheap**, or **BTCL/ExonHost**.
2. Open **Cloudflare Dashboard → Workers & Pages → `seen-studio-store` → Custom domains → Set up a custom domain**.
3. Enter `seenstudio.com` (and `www.seenstudio.com`).
   - If bought on Cloudflare, DNS + HTTPS SSL activates automatically in ~1 minute.
   - If bought elsewhere, point the domain's **Nameservers** to Cloudflare or add the `CNAME` record Cloudflare displays (`seen-studio-store.pages.dev`).
4. Optional instant Telegram order alerts:
   ```powershell
   npx wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name seen-studio-store
   npx wrangler pages secret put TELEGRAM_CHAT_ID --project-name seen-studio-store
   ```
