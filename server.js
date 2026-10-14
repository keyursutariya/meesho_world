const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Root URL
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(ROOT, safePath);

    let finalPath = null;

    // 1. Direct file check
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      finalPath = filePath;
    }
    // 2. Check if adding .html exists (e.g. /product -> product.html, /cart -> cart.html)
    else if (fs.existsSync(filePath + '.html') && fs.statSync(filePath + '.html').isFile()) {
      finalPath = filePath + '.html';
    }
    // 3. Check for product detail routes like /product/10004 or /product
    else if (pathname.startsWith('/product/') || pathname === '/product') {
      const prodHtml = path.join(ROOT, 'product.html');
      if (fs.existsSync(prodHtml) && fs.statSync(prodHtml).isFile()) {
        finalPath = prodHtml;
      }
    }
    // 4. If directory with index.html
    else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const idxHtml = path.join(filePath, 'index.html');
      if (fs.existsSync(idxHtml) && fs.statSync(idxHtml).isFile()) {
        finalPath = idxHtml;
      }
    }

    // 404 handler with fallback
    if (!finalPath) {
      // If it looks like a page request without extension, try index.html as spa fallback
      const hasExt = path.extname(pathname) !== '';
      if (!hasExt) {
        const fallback = path.join(ROOT, 'index.html');
        if (fs.existsSync(fallback)) finalPath = fallback;
      }
    }

    if (!finalPath) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(`<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px"><h1>404 - Page Not Found</h1><p>The requested page could not be found.</p><a href="/" style="color:#9f2089;font-weight:bold;text-decoration:none">Return to Meesho Home</a></body></html>`);
      return;
    }

    const ext = path.extname(finalPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(finalPath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Server Error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Meesho store server running at http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop.`);
});
