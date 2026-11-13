/* ================================================================
   MEESHO WORLD — config.js
   Central configuration file.

   HOW IT WORKS:
   ─────────────────────────────────────────────────────────────────
   LOCAL DEV  : server.js reads .env and dynamically serves this
                script with real values injected.

   VERCEL     : Set Environment Variables in Vercel Project Settings.
                Then deploy — Vercel injects them at build time via
                the vercel.json "env" field or Edge Config.

   FALLBACK   : If served as a plain static file (no server.js,
                no Vercel env), the values in this file are used.
                Update them directly when you need a quick manual
                override.
   ─────────────────────────────────────────────────────────────────
   ALL pages load this file FIRST (before app.js / tracking.js),
   so window.APP_CONFIG is always available globally.
================================================================ */

window.APP_CONFIG = {

  /* ── Meta / Facebook Pixel ─────────────────────────── */
  META_PIXEL_ID: '1511058947312930',

  /* ── UPI Payment Credentials ───────────────────────── */
  UPI_VPA:          'paytm.s3vx0km@pty',
  PAYEE_NAME:       'Kumbhani Mamataben Nareshbhai',
  TRANSACTION_NOTE: 'Verified Paytm Merchant',

  /* ── Kurti Combo Prices (applied at runtime) ────────── */
  // These override prices for products by slug pattern:
  //   prod-meesho-p*       → 1-piece (PRICE_1PC)
  //   prod-meesho-2combo-* → 2-piece combo (PRICE_2PC)
  //   prod-meesho-3combo-* → 3-piece combo (PRICE_3PC)
  PRICE_1PC: 299,
  PRICE_2PC: 499,
  PRICE_3PC: 799,

  MRP_1PC: 1499,
  MRP_2PC: 2499,
  MRP_3PC: 3999,
};

