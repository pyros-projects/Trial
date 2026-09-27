// Independent check of the exported heightmap: PNG structure, CRCs, 16-bit grayscale, and values vs. heights sampled in the page.
const fs = require('fs'), zlib = require('zlib');
const png = fs.readFileSync(process.argv[2]);
const page = JSON.parse(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
if (png.readUInt32BE(0) !== 0x89504E47) throw new Error('bad signature');
let o = 8, ihdr, idat = [], texts = {}, crcOk = true;
while (o < png.length) {
  const len = png.readUInt32BE(o), type = png.toString('ascii', o + 4, o + 8), data = png.subarray(o + 8, o + 8 + len);
  if (crc(png.subarray(o + 4, o + 8 + len)) !== png.readUInt32BE(o + 8 + len)) crcOk = false;
  if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9] };
  if (type === 'IDAT') idat.push(data);
  if (type === 'tEXt') { const z = data.indexOf(0); texts[data.toString('latin1', 0, z)] = data.toString('latin1', z + 1); }
  o += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(idat));
const N = ihdr.w, stride = 1 + N * 2;
const lo = +texts['height-min-m'], hi = +texts['height-max-m'];
let maxErr = 0;
const checks = page.samples.map(([i, h]) => {
  const x = i % N, y = Math.floor(i / N);
  if (raw[y * stride] !== 0) throw new Error('unexpected filter type');
  const v = raw.readUInt16BE(y * stride + 1 + x * 2);
  const back = lo + v / 65535 * (hi - lo);
  maxErr = Math.max(maxErr, Math.abs(back - h));
  return { i, page_h: +h.toFixed(4), png_value: v, decoded_h: +back.toFixed(4) };
});
console.log(JSON.stringify({ ihdr, grayscale: ihdr.color === 0, bitDepth: ihdr.depth, crcOk, texts, rawBytes: raw.length, expected: N * stride, checks, maxAbsErr_m: +maxErr.toExponential(2), quantStep_m: +((hi - lo) / 65535).toExponential(2) }, null, 1));
