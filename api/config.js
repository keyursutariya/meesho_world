// Vercel Serverless Function to dynamically serve /config.js from Vercel Environment Variables
module.exports = (req, res) => {
  const cfg = {
    META_PIXEL_ID:    process.env.META_PIXEL_ID    || '1511058947312930',
    UPI_VPA:          process.env.UPI_VPA           || 'paytm.s27xjuv@pty',
    PAYEE_NAME:       process.env.PAYEE_NAME        || 'Paytm',
    TRANSACTION_NOTE: process.env.TRANSACTION_NOTE  || 'Verified Paytm Account',
    PRICE_1PC:        Number(process.env.PRICE_1PC) || 299,
    PRICE_2PC:        Number(process.env.PRICE_2PC) || 499,
    PRICE_3PC:        Number(process.env.PRICE_3PC) || 799,
    MRP_1PC:          Number(process.env.MRP_1PC)   || 1499,
    MRP_2PC:          Number(process.env.MRP_2PC)   || 2499,
    MRP_3PC:          Number(process.env.MRP_3PC)   || 3999,
  };

  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.status(200).send(`/* Served live by Vercel Serverless Function */\nwindow.APP_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
};

