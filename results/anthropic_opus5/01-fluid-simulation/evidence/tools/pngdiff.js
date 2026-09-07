#!/usr/bin/env node
// Minimal dependency-free PNG reader + image differ, used to prove that the
// *rendered* output of the simulation changed (or held still) between captures.
// Usage: node pngdiff.js a.png b.png [x0 y0 x1 y1]
const fs = require('fs'), zlib = require('zlib');

function readPNG (file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png: ' + file);
  let pos = 8, ihdr = null, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4),
               depth: data[8], colorType: data[9], interlace: data[12] };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error('unsupported png: depth=' + ihdr.depth);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType];
  if (!ch) throw new Error('unsupported colorType ' + ihdr.colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width: w, height: h } = ihdr;
  const stride = w * ch;
  const out = Buffer.alloc(stride * h);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { width: w, height: h, channels: ch, data: out };
}

function diff (A, B, box) {
  if (A.width !== B.width || A.height !== B.height) throw new Error('size mismatch');
  const [x0, y0, x1, y1] = box || [0, 0, A.width, A.height];
  let n = 0, sum = 0, changed = 0, maxd = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const ia = (y * A.width + x) * A.channels;
      const ib = (y * B.width + x) * B.channels;
      const d = (Math.abs(A.data[ia] - B.data[ib]) +
                 Math.abs(A.data[ia + 1] - B.data[ib + 1]) +
                 Math.abs(A.data[ia + 2] - B.data[ib + 2])) / 3;
      sum += d; n++;
      if (d > 8) changed++;
      if (d > maxd) maxd = d;
    }
  }
  return { meanAbsDiff: +(sum / n).toFixed(3), pctPixelsChanged: +(100 * changed / n).toFixed(2), maxDiff: maxd, samples: n };
}

// mean luminance inside a box — "is there anything drawn here at all?"
function luma (A, box) {
  const [x0, y0, x1, y1] = box || [0, 0, A.width, A.height];
  let n = 0, sum = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * A.width + x) * A.channels;
    sum += 0.2126 * A.data[i] + 0.7152 * A.data[i + 1] + 0.0722 * A.data[i + 2];
    n++;
  }
  return +(sum / n).toFixed(3);
}

if (require.main === module) {
  const [a, b, ...rest] = process.argv.slice(2);
  const box = rest.length === 4 ? rest.map(Number) : null;
  const A = readPNG(a);
  if (!b) { console.log(JSON.stringify({ file: a, width: A.width, height: A.height, luma: luma(A, box) })); process.exit(0); }
  const B = readPNG(b);
  console.log(JSON.stringify(Object.assign(diff(A, B, box), { lumaA: luma(A, box), lumaB: luma(B, box) })));
}
module.exports = { readPNG, diff, luma };
