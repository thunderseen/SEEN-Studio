# SEEN Studio — Custom Domain & Permanent Cloud Backend Deployment Guide

This kit upgrades **SEEN Studio** from static GitHub Pages (`IndexedDB` browser-only storage) to a **24/7 Permanent Cloud E-Commerce Store** where every new T-shirt uploaded from Admin Studio and every customer order stays saved globally across all phones and browsers.

---

## Option A — Cloudflare Pages + D1 SQL Database (Recommended, Free Tier $0/mo + Auto SSL)

All backend files are already prepared in this repository:
- `functions/api/[[route]].js` — Full REST API (`/api/health`, `/api/catalog`, `/api/orders`, `/api/orders/status`, `/api/config`, `/api/webhook/payment`)
- `cloud/schema.sql` — Permanent D1 SQL schema
- `wrangler.toml` — Cloudflare deployment configuration

### 5-Minute Go-Live Steps
1. **Connect GitHub Repo to Cloudflare Pages:**
   - Sign in at https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select `thunderseen/SEEN-Studio` (branch `main`, build command: *empty*, output directory: `.`).
2. **Create Permanent D1 Database:**
   - In Cloudflare Dashboard → **Storage & Databases** → **D1 SQL Database** → Create database named `seen-studio-db`.
   - Open the D1 Console and run the SQL inside `cloud/schema.sql` (or run `npx wrangler d1 execute seen-studio-db --remote --file=./cloud/schema.sql`).
   - In your Cloudflare Pages project → **Settings → Bindings** → Add **D1 Database** with Variable Name **`DB`** → select `seen-studio-db` → Redeploy.
3. **Connect Your Custom Domain + Auto SSL:**
   - In Cloudflare Pages → **Custom domains** → Add your domain (e.g. `seenstudio.com` & `www.seenstudio.com`).
   - If your domain was purchased outside Cloudflare (e.g. Namecheap/BTCL), point its **Nameservers** to Cloudflare or add the `CNAME` record Cloudflare displays.
   - **SSL/TLS** activates automatically (`Full (Strict)` + HTTPS redirect).
4. **Optional Live Payment Webhook & Telegram Alerts:**
   - Set SSLCommerz IPN URL or bKash callback URL to: `https://yourdomain.com/api/webhook/payment`
   - In Cloudflare Pages → **Settings → Variables & Secrets**, optionally add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for instant Telegram order alerts.

---

## Option B — Universal Node.js Hosting (Render / Railway / VPS / cPanel)

Use the zero-dependency production server **`server.mjs`**:
- **Start Command:** `node server.mjs`
- **Persistent Disk Mount:** Set environment variable `DATA_DIR=/var/data` (mounted to a persistent volume so orders & uploaded tees survive restarts).
- **Custom Domain + Auto SSL:** Add your domain in Render/Railway Dashboard → copy the `A` / `CNAME` DNS record into your domain registrar → free Let's Encrypt SSL provisions automatically.
