// Pull the <script id="sim-core"> block out of the delivered index.html so Node tests run the shipped simulation code.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = html.match(/<script id="sim-core">([\s\S]*?)<\/script>/);
if (!m) throw new Error('sim-core script not found');
const out = path.join(__dirname, '.core-from-index.js');
fs.writeFileSync(out, m[1]);
console.log('extracted', m[1].length, 'bytes ->', out);
