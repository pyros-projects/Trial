// Authored tests. These exercise the delivered embedded codec without DOM/UI mocks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function codec() {
  const filename = path.join(__dirname, '..', 'index.html');
  assert.ok(fs.existsSync(filename), 'Delivered HTML and its codec must exist');
  const html = fs.readFileSync(filename, 'utf8');
  const match = html.match(/<script id="codec">([\s\S]*?)<\/script>/);
  assert.ok(match, 'The self-contained codec must be embedded');
  return vm.runInNewContext(match[1] + '\nAfterimageCodec;', {});
}
// Independent slow polynomial multiplication; does not use production GF tables.
function mul(a,b) {
  let r = 0;
  while (b) { if (b & 1) r ^= a; b >>= 1; a <<= 1; if (a & 256) a ^= 0x11d; }
  return r;
}
function payload(seed=17) {
  return Array.from({length:576}, () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed >>> 24; });
}
function shuffle(seed, n) {
  const a = Array.from({length:n},(_,i)=>i);
  for (let i=n-1;i>0;i--) { seed=(Math.imul(seed,1664525)+1013904223)>>>0; const j=seed%(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

test('systematic bytes and parity agree with independent linear polynomial values', () => {
  const c=codec();
  const image=Array.from({length:576},(_,i)=>mul(7,(i%24)+1)^11);
  for (const p of [4,8,12]) {
    const encoded=Array.from(c.encode(image,p));
    assert.equal(encoded.length,24*(24+p));
    for (let b=0;b<24;b++) for(let x=0;x<24+p;x++) assert.equal(encoded[b*(24+p)+x],mul(7,x+1)^11);
  }
});
test('non-preset bytes recover exactly for varied erasures through the stated limit', () => {
  const c=codec(), image=payload();
  for (const p of [4,8,12]) {
    const n=24+p, encoded=Array.from(c.encode(image,p));
    for (let loss=0;loss<=p;loss++) {
      const received=encoded.slice();
      for (let b=0;b<24;b++) for(const j of shuffle(7919*b+loss+123,n).slice(0,loss)) received[b*n+j]=null;
      const result=c.decode(received,p);
      assert.deepEqual(Array.from(result.pixels),image);
      assert.deepEqual(Array.from(result.code),encoded);
      assert.equal(result.bands.filter(b=>b.recoverable).length,24);
    }
  }
});
test('p+1 erasures leave missing data unknown and preserve surviving data', () => {
  const c=codec(), image=payload(97), p=8, n=32;
  const received=Array.from(c.encode(image,p));
  for(let j=0;j<p+1;j++) received[j]=null;
  const result=c.decode(received,p);
  assert.equal(result.bands[0].recoverable,false);
  for(let j=0;j<9;j++) assert.equal(result.pixels[j],null);
  for(let j=9;j<576;j++) assert.equal(result.pixels[j],image[j]);
  assert.equal(result.bands[0].survivors,23);
});
test('same physical four-row fold fails in rows and succeeds when woven', () => {
  const c=codec(), image=payload(271), p=8,n=32;
  for(const layout of ['rows','woven']) {
    const received=Array.from(c.encode(image,p));
    for(let r=10;r<14;r++) for(let col=0;col<n;col++) received[c.physicalToLogical(r,col,p,layout)]=null;
    const result=c.decode(received,p);
    assert.equal(received.filter(v=>v===null).length,128);
    if(layout==='woven') {
      assert.deepEqual(Array.from(result.pixels),image);
      assert.equal(result.bands.filter(b=>b.recoverable).length,24);
      assert.ok(result.bands.every(b=>b.missing<=6));
    } else {
      assert.equal(result.bands.filter(b=>b.recoverable).length,20);
      assert.equal(result.pixels.filter(v=>v===null).length,96);
    }
  }
});
test('mapping is bijective at each supported size and all loss remains unresolved', () => {
  const c=codec();
  for(const p of [4,8,12]) {
    for(const layout of ['rows','woven']) {
      const positions=[];
      for(let r=0;r<24;r++) for(let col=0;col<24+p;col++) positions.push(c.physicalToLogical(r,col,p,layout));
      assert.equal(new Set(positions).size,24*(24+p));
      assert.equal(Math.min(...positions),0);
      assert.equal(Math.max(...positions),24*(24+p)-1);
    }
    const result=c.decode(Array(24*(24+p)).fill(null),p);
    assert.equal(result.pixels.filter(v=>v===null).length,576);
    assert.equal(result.bands.filter(b=>b.recoverable).length,0);
  }
});
