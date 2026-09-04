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
const frag = tpl.replace(/\{\{asset:([^}]+)\}\}/g, (m, rel) => {
  const p = path.join(root, 'assets', rel);
  if (!fs.existsSync(p)) { missing.push(rel); return ''; }
  const ext = rel.split('.').pop().toLowerCase();
  return `data:${mime[ext] || 'application/octet-stream'};base64,${fs.readFileSync(p).toString('base64')}`;
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const fragPath = path.join(root, 'dist', 'pretakst-forside.artifact.html');
fs.writeFileSync(fragPath, frag);
const full = `<!doctype html>\n<html lang="nb">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="Pretakst – AI-drevet taksering for takstmenn. Snakk inn befaringen, få et utkast til tilstandsrapport klart til kontroll. 149 kr per rapport, ingen abonnement.">\n` +
  frag.replace(/<title>[\s\S]*?<\/title>/, m => m + '') .replace(/^(<title>.*<\/title>\s*)/, '$1') + `\n</body>\n</html>\n`;
// move title/link/style into head, rest into body
const headEnd = full.indexOf('</style>') + '</style>'.length;
const head = full.slice(0, headEnd), body = full.slice(headEnd);
const fullDoc = head + '\n</head>\n<body>' + body;
const fullPath = path.join(root, 'pretakst-forside.html');
fs.writeFileSync(fullPath, fullDoc);
const mb = p => (fs.statSync(p).size/1024/1024).toFixed(2)+'MB';
console.log('wrote', fragPath, mb(fragPath));
console.log('wrote', fullPath, mb(fullPath));
if (missing.length) console.log('MISSING assets (left empty):', missing);
