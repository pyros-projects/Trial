const fs=require('fs'),assert=require('assert');
const html=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
assert(html.includes('id="weatherCanvas"'),'delivered WebGL canvas must exist');
assert(!/<script[^>]+src=|<link[^>]+href=|\bfetch\s*\(|\bimport\s*\(/i.test(html),'artifact must not request runtime dependencies');
for(const id of ['pauseBtn','stepBtn','resetBtn','presetSelect','modeSelect','probeCanvas','stateFile','exportPng','exportCsv','seedInput'])assert(html.includes(`id="${id}"`),id+' control missing');
for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Function(script[1]);
console.log('PASS: required application controls, dependency audit and JavaScript syntax');
