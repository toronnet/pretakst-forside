// Minimal static server for the built page. Used both locally (npm run serve)
// and as the production start command (npm start) on Coolify/Nixpacks.
// Listens on PORT (Coolify) or 3000 by default, on all interfaces.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const port = parseInt(process.env.PORT, 10) || 3000;
const types = { '.html':'text/html; charset=utf-8', '.mp4':'video/mp4', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.js':'text/javascript', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml; charset=utf-8' };
// Only these paths are served; everything else (tools, src, node_modules) stays private.
const allow = [/^\/pretakst-forside\.html$/, /^\/index\.html$/, /^\/forhandsvisning-(desktop|mobil)\.png$/, /^\/assets\/web\//, /^\/assets\/fonts\/Satoshi-\w+\.ttf$/, /^\/health$/, /^\/robots\.txt$/, /^\/llms\.txt$/, /^\/sitemap\.xml$/, /^\/pages\/[\w/-]+\.html$/];
// Other domains Coolify routes to this app; they redirect to pretakst.no
const aliases = ['www.pretakst.no', 'pretakst.getonnet.cloud'];
// Old URLs (Webflow site and earlier footer links) that now live elsewhere
const redirects = {
  '/favicon.ico': '/assets/web/favicon-32.png',
  '/policy.html': '/personvernerklaering',
  '/personvern': '/personvernerklaering',
  '/blogs/byggskader-koster-milliarder---hva-kan-vi-laere-og-hvordan-kan-teknologi-hjelpe': '/blogs/byggskader-koster-milliarder---hva-kan-vi-laere-og-hvordan-kan-teknologi-hjelpe-2',
};

const zlib = require('zlib');
const compressible = /^(text\/|application\/(xml|json)|image\/svg)/;

// Contact form ("Vil du heller at vi tar kontakt?") -> email to post@pretakst.no.
// With SMTP_USER and SMTP_PASS set in Coolify it sends through that account (Domeneshop by default).
// Without them it delivers straight to the recipient's mail server (MX, port 25) with no login;
// that needs no setup but may land in spam. If sending fails the page tells the visitor to write
// to post@pretakst.no instead.
const nodemailer = require('nodemailer');
const smtp = {
  host: process.env.SMTP_HOST || 'smtp.domeneshop.no', port: parseInt(process.env.SMTP_PORT, 10) || 587,
  user: process.env.SMTP_USER, pass: process.env.SMTP_PASS,
  to: process.env.MAIL_TO || 'post@pretakst.no',
};
// Send from the login address, else from the inbox itself: Domeneshop rejects senders on its own
// domain that have no mailbox ("553 ... No such user here"), and its usernames are often not addresses
smtp.from = process.env.MAIL_FROM || (/@/.test(smtp.user || '') ? smtp.user : smtp.to);
const timeouts = { connectionTimeout: 10e3, greetingTimeout: 10e3, socketTimeout: 15e3 }; // never leave the visitor waiting
const loginMailer = smtp.user && smtp.pass && nodemailer.createTransport({
  host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: { user: smtp.user, pass: smtp.pass }, ...timeouts,
});
async function mailer() {
  if (loginMailer) return loginMailer;
  const mx = (await require('dns').promises.resolveMx(smtp.to.split('@')[1])).sort((a, b) => a.priority - b.priority)[0].exchange;
  return nodemailer.createTransport({ host: mx, port: 25, secure: false, name: 'pretakst.no', tls: { rejectUnauthorized: false }, ...timeouts });
}
const recent = new Map(); // ip -> timestamps of recent submissions
function contact(req, res) {
  const reply = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now(), hits = (recent.get(ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= 5) return reply(429, { error: 'for mange forsøk' });
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 4096) req.destroy(); });
  req.on('end', async () => {
    let data;
    try { data = JSON.parse(raw); } catch { return reply(400, { error: 'ugyldig' }); }
    const email = String(data.email || '').trim();
    if (data.website) return reply(200, { ok: true }); // honeypot filled in: a bot, pretend it worked
    if (email.length > 200 || !/^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(email)) return reply(400, { error: 'ugyldig e-post' });
    recent.set(ip, [...hits, now]);
    try {
      await (await mailer()).sendMail({
        from: `"Pretakst nettside" <${smtp.from}>`, to: smtp.to, replyTo: email,
        subject: `Ny henvendelse fra pretakst.no: ${email}`,
        text: `Noen ba om å bli kontaktet via skjemaet «Vil du heller at vi tar kontakt?» på pretakst.no.\n\nE-post: ${email}\nTidspunkt: ${new Date().toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' })}\n\nSvar på denne e-posten for å svare personen direkte.`,
      });
      console.log('kontakt: e-post sendt til', smtp.to, loginMailer ? 'via ' + smtp.host : 'direkte til MX');
      reply(200, { ok: true });
    } catch (e) {
      console.error('kontakt: sending feilet', e.message);
      reply(502, { error: 'sending feilet' });
    }
  });
}

http.createServer((req, res) => {
  const [rawPath, query] = req.url.split('?');
  let p;
  try { p = decodeURIComponent(rawPath); } catch { res.writeHead(400); return res.end(); }
  const qs = query ? '?' + query : '';
  const moved = to => { res.writeHead(301, { Location: to }); res.end(); };
  // health check answers on any host (Coolify calls it from inside the container)
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  // one canonical URL per page: pretakst.no only, no trailing slash, no file names for pages
  const host = (req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  if (aliases.includes(host)) return moved('https://pretakst.no' + req.url);
  if (p === '/api/kontakt') {
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end(); }
    return contact(req, res);
  }
  if (p.length > 1 && p.endsWith('/')) return moved(p.slice(0, -1) + qs);
  if (p === '/index.html' || p === '/pretakst-forside.html') return moved('/' + qs);
  const page = p.match(/^\/pages(\/[\w/-]+)\.html$/);
  if (page) return moved(page[1] + qs);
  if (redirects[p]) return moved(redirects[p]);
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
