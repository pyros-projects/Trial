#!/usr/bin/env bash
# Assembles index.html from src/.  The delivered file is self-contained:
# no bundler, no runtime dependencies, no network requests.  Sources are kept
# split so the DOM-free physics core can be unit-tested in Node against the
# exact bytes that ship (tests/core-test.mjs --built).
set -e
cd "$(dirname "$0")"
cat src/01-top.html src/02-core.js src/03-ui.js src/04-ui.js src/05-ui.js src/06-tail.html > index.html
node -e '
const fs=require("fs");const s=fs.readFileSync("index.html","utf8");
const body=s.slice(s.indexOf("<script>")+8, s.lastIndexOf("</script>"));
try { new Function(body); } catch(e){ console.error("SCRIPT PARSE FAILED:", e.message); process.exit(1); }
const hits=(body.match(/https?:\/\//g)||[]).length;
console.log("index.html "+(s.length/1024).toFixed(1)+" kB · script parses OK · http refs: "+hits);
'
