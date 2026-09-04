// Minimal static server for the built page. Used both locally (npm run serve)
// and as the production start command (npm start) on Coolify/Nixpacks.
// Listens on PORT (Coolify) or 3000 by default, on all interfaces.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const port = parseInt(process.env.PORT, 10) || 3000;
const types = { '.html':'text/html; charset=utf-8', '.mp4':'video/mp4', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.js':'text/javascript', '.txt':'text/plain; charset=utf-8' };
// Only these paths are served; everything else (tools, src, node_modules) stays private.
const allow = [/^\/pretakst-forside\.html$/, /^\/index\.html$/, /^\/forhandsvisning-(desktop|mobil)\.png$/, /^\/assets\/web\//, /^\/health$/];

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/pretakst-forside.html';
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  const f = path.join(root, p);
  if (!allow.some(re => re.test(p)) || !f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Ikke funnet');
  }
  const cache = p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300';
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': cache });
  fs.createReadStream(f).pipe(res);
}).listen(port, '0.0.0.0', () => console.log('pretakst-forside serving', root, 'on http://0.0.0.0:' + port));
