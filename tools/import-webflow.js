// One-off import of the subpages from the old Webflow site (pretakst.webflow.io).
// Writes content fragments to src/sider/*.html and blog images to assets/web/blog/*.webp.
// Run: node tools/import-webflow.js   (then npm run build)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const base = 'https://pretakst.webflow.io';

const blogs = [
  { slug: 'byggskader-koster-milliarder---hva-kan-vi-laere-og-hvordan-kan-teknologi-hjelpe-2', category: 'Byggskader', img: 'byggskader' },
  { slug: 'endring-i-forskrift-til-avhendingslova', category: 'Regelverk', img: 'avhendingslova' },
  { slug: 'hoststormen-amy-er-pa-vei---husk-a-forberede-deg', category: 'Vær og skader', img: 'hoststorm' },
];
const legal = [
  { slug: 'kjopsbetingelser', category: 'Vilkår', description: 'Kjøpsbetingelser for Pretakst: priser per rapport, betaling, oppsigelse, angrerett og ansvar.' },
  { slug: 'personvernerklaering', category: 'Personvern', description: 'Slik samler Pretakst inn, bruker, lagrer og beskytter personopplysninger, og hvilke rettigheter du har.' },
];

// inner HTML of the first element whose opening tag contains `marker`
function inner(html, marker) {
  const i = html.indexOf(marker);
  if (i < 0) return '';
  const open = html.lastIndexOf('<', i);
  const tag = html.slice(open + 1).match(/^\w+/)[0];
  const start = html.indexOf('>', i) + 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = start;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (!depth) return html.slice(start, m.index);
  }
  return html.slice(start);
}
const text = s => s.replace(/<[^>]+>/g, '').replace(/‍/g, '').replace(/\s+/g, ' ').trim();
const clean = s => s.replace(/‍/g, '').replace(/https:\/\/pretakst\.no\/?\?utm_source=[\w.]+/g, '/').replace(/[?&]utm_source=[\w.]+/g, '').replace(/ (class|id|loading|sizes|srcset|style|animate-on-load)="[^"]*"/g, '');

async function image(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const out = path.join(root, 'assets', 'web', 'blog', name + '.webp');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
  return `/assets/web/blog/${name}.webp`;
}

function write(slug, meta, body) {
  const out = path.join(root, 'src', 'sider', slug + '.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `<!--${JSON.stringify(meta)}-->\n${body.trim()}\n`);
  console.log('wrote', path.relative(root, out));
}

(async () => {
  for (const b of blogs) {
    const html = await (await fetch(`${base}/blogs/${b.slug}`)).text();
    const title = text(inner(html, 'class="heading-3"'));
    const lead = text(inner(html, 'class="text-size-large"'));
    const hero = (inner(html, 'class="blog-image"').match(/src="([^"]+)"/) || [])[1];
    let body = clean(inner(html, 'blog-content w-richtext'));
    body = body.replace(/^\s*<h1>[\s\S]*?<\/h1>/, '').replace(/<p>(<br\/?>)+/g, '<p>').replace(/<p>\s*<\/p>/g, '');
    const imgs = [...body.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/g)];
    // Webflow shows no dates; asset ids are Mongo ObjectIds whose first 8 hex digits are the upload time
    const uploaded = [hero, ...imgs.map(m => m[1])].map(u => (u || '').match(/\/([0-9a-f]{24})_/)).filter(Boolean)
      .map(m => new Date(parseInt(m[1].slice(0, 8), 16) * 1000).toISOString().slice(0, 10)).sort();
    for (const [n, m] of imgs.entries()) body = body.replace(m[1], await image(m[1], `${b.img}-${n + 1}`));
    body = body.replace(/<img alt=""/g, `<img alt="${title.replace(/"/g, '&quot;')}"`);
    const meta = { path: `/blogs/${b.slug}`, kind: 'blog', category: b.category, title, description: lead,
      published: uploaded[0], modified: uploaded[uploaded.length - 1] };
    if (hero) meta.image = await image(hero, b.img);
    write(b.slug, meta, `<p class="lead">${lead}</p>\n${body}`);
  }
  for (const l of legal) {
    const html = await (await fetch(`${base}/${l.slug}`)).text();
    const title = text(inner(html, 'pricing-title kjopsbetingelser'));
    // move trailing line breaks out of <strong>, drop empty <strong></strong>
    let body = clean(inner(html, 'text-block-7')).replace(/((?:<br\/>\s*)+)<\/strong>/g, '</strong>$1').replace(/<strong>\s*<\/strong>/g, '');
    // Webflow stored these as one block: "<strong>3. Heading</strong>" becomes h2, blank lines become paragraphs
    body = body.replace(/(?:<br\/>)*<strong>(\d+\.\s[^<]+?)\s*<\/strong>(?:<br\/>)*/g, '</p><h2>$1</h2><p>')
      .replace(/(<br\/>\s*){2,}/g, '</p><p>').replace(/<p>(<br\/>)+/g, '<p>').replace(/(<br\/>)+<\/p>/g, '</p>');
    body = ('<p>' + body + '</p>').replace(/<p>\s*<\/p>/g, '').replace(/pretakst\.no\/personvern\b/g, '<a href="/personvernerklaering">pretakst.no/personvernerklaering</a>');
    write(l.slug, { path: `/${l.slug}`, kind: 'legal', category: l.category, title, description: l.description }, body);
  }
})().catch(e => { console.error(e); process.exit(1); });
