const sharp = require('sharp');
const fs = require('fs');
const jobs = [
  ['assets/gen/still-b.png', 'assets/web/poster.jpg', { width: 1600, fmt: 'jpeg', q: 78 }],
  ['assets/gen/still-b.png', 'assets/web/poster-small.jpg', { width: 900, fmt: 'jpeg', q: 70 }],
  ['assets/device-1.png', 'assets/web/phone.webp', { width: 640, fmt: 'webp', q: 82 }],
  ['assets/report-2.png', 'assets/web/dashboard.webp', { width: 1400, fmt: 'webp', q: 80 }],
  ['assets/front-a4-a.png', 'assets/web/report-cover.webp', { width: 640, fmt: 'webp', q: 84 }],
  ['assets/skjermbilde-2025.png', 'assets/web/editor.webp', { width: 1400, fmt: 'webp', q: 80 }],
  ['assets/hero-22222.png', 'assets/web/donut.webp', { width: 320, fmt: 'webp', q: 92 }],
  ['assets/image-81.png', 'assets/web/waveform.webp', { width: 489, fmt: 'webp', q: 92 }],
  ['assets/hero-image.png', 'assets/web/inspector.webp', { width: 414, fmt: 'webp', q: 82 }],
  ['assets/house.png', 'assets/web/client.webp', { width: 443, fmt: 'webp', q: 82 }],
  ['assets/blog-byggskader.png', 'assets/web/blog-1.webp', { width: 800, fmt: 'webp', q: 78 }],
  ['assets/blog-avhendingslova.png', 'assets/web/blog-2.webp', { width: 800, fmt: 'webp', q: 78 }],
  ['assets/blog-hoststorm.png', 'assets/web/blog-3.webp', { width: 800, fmt: 'webp', q: 78 }],
];
(async () => {
  for (const [src, out, o] of jobs) {
    let img = sharp(src).resize({ width: o.width, withoutEnlargement: true });
    img = o.fmt === 'jpeg' ? img.jpeg({ quality: o.q, mozjpeg: true }) : img.webp({ quality: o.q });
    const info = await img.toFile(out);
    console.log(out.padEnd(32), `${info.width}x${info.height}`, (info.size/1024).toFixed(0)+'KB');
  }
  // dominant colours of poster for masking decisions
  const st = await sharp('assets/gen/still-b.png').resize(8,8).raw().toBuffer();
  console.log('poster corner px (top-left, bottom-right):', [...st.slice(0,3)], [...st.slice(st.length-3)]);
})().catch(e=>{console.error(e);process.exit(1)});
