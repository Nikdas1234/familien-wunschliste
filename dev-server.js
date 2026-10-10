// Kleiner Testserver für den eigenen Rechner: liefert die Dateien dieses Ordners aus.
// Start: node dev-server.js   ->   http://localhost:5180
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5180;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath);
    // Nichts außerhalb des Projektordners ausliefern.
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        // Wie beim echten Server: Daran erkennt die App, ob es eine neuere Fassung gibt.
        'Last-Modified': fs.statSync(file).mtime.toUTCString(),
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  })
  .listen(PORT, () => console.log(`Wunschliste läuft auf http://localhost:${PORT}`));
