// Minimal PNG reader (8-bit RGB/RGBA, non-interlaced) for evidence checks.
// usage: node png.js file.png [x,y ...]   -> prints size, colour type, and RGBA at the given points
const fs = require('fs'), zlib = require('zlib');
const buf = fs.readFileSync(process.argv[2]);
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
let p = 8, W, H, bd, ct, idat = [];
while (p < buf.length) {
  const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
  if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
  if (type === 'IDAT') idat.push(d);
  p += 12 + len;
}
const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
if (bd !== 8 || !bpp) throw new Error(`unsupported bd=${bd} ct=${ct}`);
const raw = zlib.inflateSync(Buffer.concat(idat)), stride = W * bpp, px = Buffer.alloc(H * stride);
for (let y = 0; y < H; y++) {
  const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? row[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0;
    let v = src[i];
    if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    row[i] = v & 255;
  }
}
const out = { width: W, height: H, colorType: ct === 6 ? 'RGBA' : 'RGB', points: {} };
for (const s of process.argv.slice(3)) { const [x, y] = s.split(',').map(Number); const o = y * stride + x * bpp; out.points[s] = '#' + [...px.subarray(o, o + 3)].map((v) => v.toString(16).padStart(2, '0')).join('') + (bpp === 4 ? ' a=' + px[o + 3] : ''); }
console.log(JSON.stringify(out));
