// Build: embeds fonts, images and video into self-contained HTML files.
//  - pretakst-forside.html          full standalone document (open directly in a browser)
//  - dist/pretakst-forside.artifact.html  fragment for the Artifact tool (no doctype/html/head/body)
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', ttf:'font/ttf', mp4:'video/mp4', woff2:'font/woff2' };
const tpl = fs.readFileSync(path.join(root, 'src', 'forside.template.html'), 'utf8');
const banned = require('./guard.js');
if (banned.test(tpl)) { console.error('BUILD STOPPED: template mentions Norsk takst / integrasjon, which must not appear on the page'); process.exit(1); }
const missing = [];
const inline = s => s.replace(/\{\{asset:([^}]+)\}\}/g, (m, rel) => {
  const p = path.join(root, 'assets', rel);
  if (!fs.existsSync(p)) { missing.push(rel); return ''; }
  const ext = rel.split('.').pop().toLowerCase();
  return `data:${mime[ext] || 'application/octet-stream'};base64,${fs.readFileSync(p).toString('base64')}`;
});
const frag = inline(tpl);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const fragPath = path.join(root, 'dist', 'pretakst-forside.artifact.html');
fs.writeFileSync(fragPath, frag);
// Google Tag Manager + GA4, only in the full document (not the Artifact fragment)
const tracking = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TN6GJSRW');</script>
<!-- End Google Tag Manager -->
<!-- Google tag (gtag.js) - GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SN1J2MLE71"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-SN1J2MLE71');
</script>
`;
const trackingNoscript = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TN6GJSRW"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
`;
const full = `<!doctype html>\n<html lang="nb">\n<head>\n<meta charset="utf-8">\n${tracking}<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="Pretakst – AI-drevet taksering for takstmenn. Snakk inn befaringen, få et utkast til tilstandsrapport klart til kontroll. 149 kr per rapport, ingen abonnement.">\n` +
  `<link rel="canonical" href="https://pretakst.no/">\n<meta property="og:type" content="website">\n<meta property="og:title" content="Pretakst – AI-drevet taksering for takstmenn">\n` +
  `<meta property="og:description" content="Snakk inn befaringen, få et utkast til tilstandsrapport klart til kontroll. 149 kr per rapport, ingen abonnement.">\n` +
  `<meta property="og:url" content="https://pretakst.no/">\n<meta property="og:image" content="https://pretakst.no/assets/web/poster.jpg">\n` +
  `<link rel="icon" type="image/png" href="/assets/web/favicon-32.png">\n<link rel="apple-touch-icon" href="/assets/web/icon-256.png">\n` +
  frag.replace(/<title>[\s\S]*?<\/title>/, m => m + '') .replace(/^(<title>.*<\/title>\s*)/, '$1') + `\n</body>\n</html>\n`;
// move title/link/style into head, rest into body
const headEnd = full.indexOf('</style>') + '</style>'.length;
const head = full.slice(0, headEnd), body = full.slice(headEnd);
const fullDoc = head + '\n</head>\n<body>\n' + trackingNoscript + body;
const fullPath = path.join(root, 'pretakst-forside.html');
fs.writeFileSync(fullPath, fullDoc);
fs.writeFileSync(path.join(root, 'index.html'), fullDoc); // same page, for static hosting
const mb = p => (fs.statSync(p).size/1024/1024).toFixed(2)+'MB';
console.log('wrote', fragPath, mb(fragPath));
console.log('wrote', fullPath, mb(fullPath));

// Subpages (blog posts, terms, privacy): src/sider/*.html -> pages/<path>.html, served by tools/serve.js.
// Each source starts with <!--{json meta}-->; the content was imported from Webflow by tools/import-webflow.js.
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const sideTpl = inline(fs.readFileSync(path.join(root, 'src', 'side.template.html'), 'utf8'));
const sideDir = path.join(root, 'src', 'sider');
fs.rmSync(path.join(root, 'pages'), { recursive: true, force: true });
const sitemap = ['/'];
for (const file of fs.readdirSync(sideDir).filter(f => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(sideDir, file), 'utf8');
  if (banned.test(src)) { console.error('BUILD STOPPED: ' + file + ' mentions Norsk takst / integrasjon'); process.exit(1); }
  const [, json, content] = src.match(/^<!--(\{[\s\S]*?\})-->\n([\s\S]*)$/);
  const meta = JSON.parse(json);
  const blog = meta.kind === 'blog';
  const vars = {
    tracking, trackingNoscript,
    // hero image goes right after the lead paragraph
    content: meta.image ? content.replace('</p>', `</p>\n<img class="hero-img" src="${meta.image}" alt="">`) : content,
    // search engines show ~155 characters; cut at a word boundary
    title: esc(meta.title), description: esc(meta.description.length > 160 ? meta.description.slice(0, 155).replace(/\s+\S*$/, '') + '…' : meta.description), path: meta.path, category: esc(meta.category),
    ogType: blog ? 'article' : 'website',
    ogImage: meta.image ? `<meta property="og:image" content="https://pretakst.no${meta.image}">\n` : '',
    backHref: blog ? '/#aktuelt' : '/', backLabel: blog ? 'Alle artikler' : 'Til forsiden',
  };
  const html = sideTpl.replace(/\{\{(\w+)\}\}/g, (m, k) => k in vars ? vars[k] : m);
  const out = path.join(root, 'pages', meta.path + '.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  sitemap.push(meta.path);
  console.log('wrote', path.relative(root, out));
}
fs.writeFileSync(path.join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemap.map(p => `  <url><loc>https://pretakst.no${p}</loc></url>\n`).join('') + '</urlset>\n');
console.log('wrote sitemap.xml');
if (missing.length) console.log('MISSING assets (left empty):', missing);
