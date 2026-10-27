// Minimal static server for the built page. Used both locally (npm run serve)
// and as the production start command (npm start) on Coolify/Nixpacks.
// Listens on PORT (Coolify) or 3000 by default, on all interfaces.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const port = parseInt(process.env.PORT, 10) || 3000;
const types = { '.html':'text/html; charset=utf-8', '.mp4':'video/mp4', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.js':'text/javascript', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml; charset=utf-8' };
// Only these paths are served; everything else (tools, src, node_modules) stays private.
const allow = [/^\/pretakst-forside\.html$/, /^\/index\.html$/, /^\/forhandsvisning-(desktop|mobil)\.png$/, /^\/assets\/web\//, /^\/assets\/fonts\/Satoshi-\w+\.ttf$/, /^\/health$/, /^\/robots\.txt$/, /^\/llms\.txt$/, /^\/sitemap\.xml$/, /^\/pages\/[\w/-]+\.html$/];
// Old URLs (Webflow site and earlier footer links) that now live elsewhere
const redirects = {
  '/favicon.ico': '/assets/web/favicon-32.png',
  '/policy.html': '/personvernerklaering',
  '/personvern': '/personvernerklaering',
  '/blogs/byggskader-koster-milliarder---hva-kan-vi-laere-og-hvordan-kan-teknologi-hjelpe': '/blogs/byggskader-koster-milliarder---hva-kan-vi-laere-og-hvordan-kan-teknologi-hjelpe-2',
};

const zlib = require('zlib');
const compressible = /^(text\/|application\/(xml|json)|image\/svg)/;

http.createServer((req, res) => {
  const [rawPath, query] = req.url.split('?');
  let p = decodeURIComponent(rawPath);
  const qs = query ? '?' + query : '';
  const moved = to => { res.writeHead(301, { Location: to }); res.end(); };
  // one canonical URL per page: no www, no trailing slash, no file names for pages
  const host = req.headers.host || '';
  if (/^www\./i.test(host)) return moved('https://' + host.slice(4) + req.url);
  if (p.length > 1 && p.endsWith('/')) return moved(p.slice(0, -1) + qs);
  if (p === '/index.html' || p === '/pretakst-forside.html') return moved('/' + qs);
  const page = p.match(/^\/pages(\/[\w/-]+)\.html$/);
  if (page) return moved(page[1] + qs);
  if (redirects[p]) return moved(redirects[p]);
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (p === '/') p = '/index.html';
  // clean URLs for subpages: /kjopsbetingelser -> pages/kjopsbetingelser.html
  else if (!path.extname(p)) p = '/pages' + p + '.html';
  const f = path.join(root, p);
  if (!allow.some(re => re.test(p)) || !f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Ikke funnet');
  }
  const type = types[path.extname(f)] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=604800' : 'public, max-age=300', Vary: 'Accept-Encoding' };
  const size = fs.statSync(f).size;
  // byte ranges, needed for the hero video in Safari
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && type === 'video/mp4') {
    const start = range[1] ? +range[1] : size - +range[2], end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(f, { start, end }).pipe(res);
  }
  if (type === 'video/mp4') headers['Accept-Ranges'] = 'bytes';
  if (compressible.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(f).pipe(zlib.createGzip()).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  req.method === 'HEAD' ? res.end() : fs.createReadStream(f).pipe(res);
}).listen(port, '0.0.0.0', () => console.log('pretakst-forside serving', root, 'on http://0.0.0.0:' + port));
