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
// linked=true: assets over 16 KB become /assets/... URLs instead of data URIs (the served pages,
// so the HTML stays small and video/fonts/images are cached separately)
const inline = (s, linked) => s.replace(/\{\{asset:([^}]+)\}\}/g, (m, rel) => {
  const p = path.join(root, 'assets', rel);
  if (!fs.existsSync(p)) { missing.push(rel); return ''; }
  if (linked && fs.statSync(p).size > 16 * 1024) return '/assets/' + rel;
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
// SEO head shared by the front page and subpages: Open Graph, Twitter card, icons, JSON-LD
const site = 'https://pretakst.no';
const org = {
  '@type': 'Organization', '@id': site + '/#org', name: 'Pretakst', legalName: 'Pretakst AS', url: site + '/',
  logo: site + '/assets/web/icon-256.png', email: 'post@pretakst.no', taxID: '932889692',
  sameAs: ['https://www.facebook.com/profile.php?id=61555283876217', 'https://www.linkedin.com/company/pretakst-as/'],
};
const seoHead = ({ title, description, url, image, type, jsonld }) =>
  `<title>${title}</title>\n<meta name="description" content="${description}">\n<link rel="canonical" href="${url}">\n` +
  `<meta property="og:type" content="${type}">\n<meta property="og:site_name" content="Pretakst">\n<meta property="og:locale" content="nb_NO">\n` +
  `<meta property="og:title" content="${title}">\n<meta property="og:description" content="${description}">\n<meta property="og:url" content="${url}">\n` +
  `<meta property="og:image" content="${image}">\n<meta name="twitter:card" content="summary_large_image">\n` +
  `<link rel="icon" type="image/png" href="/assets/web/favicon-32.png">\n<link rel="apple-touch-icon" href="/assets/web/icon-256.png">\n` +
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonld })}</script>\n`;

const frontTitle = 'Pretakst – AI-drevet tilstandsrapport for takstmenn';
const frontDesc = 'Snakk inn befaringen, og få et utkast til tilstandsrapport sortert på bygningsdel og tilstandsgrad. 149 kr per rapport, ingen abonnement.';
const frontHead = seoHead({
  title: frontTitle, description: frontDesc, url: site + '/', image: site + '/assets/web/poster.jpg', type: 'website',
  jsonld: [org,
    { '@type': 'WebSite', '@id': site + '/#website', url: site + '/', name: 'Pretakst', inLanguage: 'nb', publisher: { '@id': site + '/#org' } },
    { '@type': 'SoftwareApplication', name: 'Pretakst', url: 'https://app.pretakst.no', applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', description: frontDesc, publisher: { '@id': site + '/#org' },
      offers: { '@type': 'Offer', price: '149', priceCurrency: 'NOK', description: 'Per ferdigstilt tilstandsrapport, eks. mva. Ingen abonnement.',
        priceSpecification: { '@type': 'UnitPriceSpecification', price: '149', priceCurrency: 'NOK', valueAddedTaxIncluded: false } } }],
});
// frag starts with <title>, Google Fonts <link> and <style>: those go in <head>, the rest in <body>
const frontDoc = linked => {
  const page = inline(tpl, linked).replace(/<title>[\s\S]*?<\/title>\s*/, '');
  const headEnd = page.indexOf('</style>') + '</style>'.length;
  return `<!doctype html>\n<html lang="nb">\n<head>\n<meta charset="utf-8">\n${tracking}<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    frontHead + page.slice(0, headEnd) + '\n</head>\n<body>\n' + trackingNoscript + page.slice(headEnd) + '\n</body>\n</html>\n';
};
const fullPath = path.join(root, 'pretakst-forside.html');
fs.writeFileSync(fullPath, frontDoc(false)); // standalone, opens straight from disk
fs.writeFileSync(path.join(root, 'index.html'), frontDoc(true)); // served at /, assets linked
const mb = p => (fs.statSync(p).size/1024/1024).toFixed(2)+'MB';
console.log('wrote', fragPath, mb(fragPath));
console.log('wrote', fullPath, mb(fullPath));
console.log('wrote index.html', mb(path.join(root, 'index.html')));

// Subpages (blog posts, terms, privacy): src/sider/*.html -> pages/<path>.html, served by tools/serve.js.
// Each source starts with <!--{json meta}-->; the content was imported from Webflow by tools/import-webflow.js.
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const sideTpl = inline(fs.readFileSync(path.join(root, 'src', 'side.template.html'), 'utf8'), true);
const dateNb = d => new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const sideDir = path.join(root, 'src', 'sider');
fs.rmSync(path.join(root, 'pages'), { recursive: true, force: true });
const sitemap = ['/'];
for (const file of fs.readdirSync(sideDir).filter(f => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(sideDir, file), 'utf8');
  if (banned.test(src)) { console.error('BUILD STOPPED: ' + file + ' mentions Norsk takst / integrasjon'); process.exit(1); }
  const [, json, content] = src.match(/^<!--(\{[\s\S]*?\})-->\n([\s\S]*)$/);
  const meta = JSON.parse(json);
  const blog = meta.kind === 'blog';
  const url = site + meta.path, image = site + (meta.image || '/assets/web/poster.jpg');
  // search engines show ~155 characters; cut at a word boundary
  const description = meta.description.length > 160 ? meta.description.slice(0, 155).replace(/\s+\S*$/, '') + '…' : meta.description;
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Pretakst', item: site + '/' },
    { '@type': 'ListItem', position: 2, name: meta.title, item: url }] };
  const jsonld = blog
    ? [org, crumbs, { '@type': 'BlogPosting', headline: meta.title, description, image, url, mainEntityOfPage: url, inLanguage: 'nb',
        articleSection: meta.category, datePublished: meta.published, dateModified: meta.modified,
        author: { '@id': site + '/#org' }, publisher: { '@id': site + '/#org' } }]
    : [org, crumbs, { '@type': 'WebPage', name: meta.title, url, inLanguage: 'nb', publisher: { '@id': site + '/#org' } }];
  const vars = {
    tracking, trackingNoscript,
    seoHead: seoHead({ title: esc(/pretakst/i.test(meta.title) ? meta.title : meta.title + ' – Pretakst'), description: esc(description), url, image, type: blog ? 'article' : 'website', jsonld }),
    // hero image goes right after the lead paragraph
    content: meta.image ? content.replace('</p>', `</p>\n<img class="hero-img" src="${meta.image}" alt="${esc(meta.title)}" fetchpriority="high">`) : content,
    title: esc(meta.title), category: esc(meta.category),
    kicker: esc(meta.category) + (meta.published ? ` · <time datetime="${meta.published}">${dateNb(meta.published)}</time>` : ''),
    backHref: blog ? '/#aktuelt' : '/', backLabel: blog ? 'Alle artikler' : 'Til forsiden',
  };
  const html = sideTpl.replace(/\{\{(\w+)\}\}/g, (m, k) => k in vars ? vars[k] : m);
  const out = path.join(root, 'pages', meta.path + '.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  sitemap.push(meta.path + (meta.modified ? '|' + meta.modified : ''));
  console.log('wrote', path.relative(root, out));
}
fs.writeFileSync(path.join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemap.map(e => { const [p, mod] = e.split('|'); return `  <url><loc>${site}${p}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>\n`; }).join('') + '</urlset>\n');
console.log('wrote sitemap.xml');
if (missing.length) console.log('MISSING assets (left empty):', missing);
