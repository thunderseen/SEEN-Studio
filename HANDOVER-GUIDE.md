# س · SEEN — Men & Women Spatial Virtual T-Shirt E-Commerce Store
**Complete Handover, Backend & Deployment Guide** (Prepared for Jayed Jaman Seen)

## Quick Start (Full-Stack Local Server)
Double-click **`start-store.bat`** inside `virtualfit/`.
- Launches the zero-dependency Full-Stack REST API + Static Server (`server.ps1`) on `http://127.0.0.1:8787/`
- Automatically opens the active storefront in your default browser

## Full-Stack Backend API (Included & Active Now)
`server.ps1` provides real persistent JSON storage inside `virtualfit/data/` (`orders.json`, `catalog.json`, `config.json`):
- `GET /api/health` — Live server & database status
- `GET /api/orders` — Fetch all customer orders across devices/browsers
- `POST /api/orders` — Persist new bKash / Nagad / Rocket / Card / COD orders permanently on disk
- `POST /api/orders/status` — Update order status (`Pending Verification` → `Verified Paid` → `Shipped` → `Delivered`) live for customer Order Tracking
- `GET` / `POST /api/catalog` — Persist custom Admin auto-mockups & live USD/BDT price edits server-side
- `GET` / `POST /api/config` — Persist handover webhook, SSLCommerz Store ID, and WhatsApp receiver settings

> **Offline / Static Hosting Compatibility:** If you upload `index.html` + `assets/` directly to Netlify, Vercel, GitHub Pages, or cPanel without running `server.ps1`, the storefront automatically falls back to browser `IndexedDB` + optional external Webhook POST URL (configurable inside Admin → Gateway & Handover).

## Payment Gateway Status (100% Transparent Handover Notes)
- **Active Today (Ready for Real Orders Immediately):**
  - **bKash Direct Merchant Verification:** Your bKash number (`+8801721255494`) is securely concealed inside the sharp custom vector **bKash icon** (never exposed openly in plain text on the storefront). Customers tap the bKash icon to copy the verified merchant number securely, complete Send Money in their bKash app, submit their `TrxID`, receive a printable HTML invoice + WhatsApp confirmation, and their order logs directly into `data/orders.json` + Admin → Orders & Transactions for verification.
  - **Nagad / Rocket / Cash on Delivery (COD):** Active out of the box with live order logging, promo codes (`SEEN10`, `JAYED10`), printable invoices, and live Order Tracking.
- **Optional Future Upgrade (Automated Auto-Debit Popups):**
  - Automated card/bKash auto-debit popups (where money is deducted automatically without manual TrxID review) require official registered Merchant API credentials (`app_key` / `app_secret` from bKash Merchant Portal or `store_id` / `store_passwd` from SSLCommerz, which require a Bangladesh Trade License). Plug your live endpoint URL or Store ID directly into **Admin → Gateway & Handover** when ready.

## Storefront Highlights
1. **24 Designer & Essential T-Shirts (12 Men + 12 Women):**
   - Pure headless matte-platinum sculptural **Male** and **Female** mannequins (zero human face/head, zero legs, silky waist dissolve, contour-traced collar & cuffs).
   - Top **`♂ Men` | `♀ Women`** switcher with crisp male & female icons + elevated platinum Arabic **`س`** monogram clearly framed above the shoulders.
2. **Women-Only Bottom-Left Color Palette:**
   - Displays in the bottom-left corner exclusively in the **Women** section (hidden in **Men**), with 10 curated favorite shades that live-tint the female mannequin in real time.
3. **Admin Control Center (Password: `sabasagol`):**
   - Access via left-rail upload icon, footer **Admin** button, or **`Ctrl + Shift + A`**.
   - Auto-Mockup single/batch upload for Men or Women, live USD/BDT pricing, live Orders & TrxID verification ledger with **CSV Export**, and full **JSON Store Snapshot Export/Import** for client handover.
