#!/usr/bin/env bash
# Assemble the single-file index.html from src parts.
set -euo pipefail
cd "$(dirname "$0")"

node -e '
const fs=require("fs");
const shell=fs.readFileSync("src/shell.html","utf8");
const css=fs.readFileSync("src/style.css","utf8");
const sim=fs.readFileSync("src/sim.js","utf8");
const view=fs.readFileSync("src/view.js","utf8");
const ui=fs.readFileSync("src/ui.js","utf8");
let out=shell.replace("/*__CSS__*/",()=>css)
             .replace("/*__JS_SIM__*/",()=>sim)
             .replace("/*__JS_VIEW__*/",()=>view)
             .replace("/*__JS_UI__*/",()=>ui);
if(/__JS_SIM__|__JS_VIEW__|__JS_UI__|__CSS__/.test(out)) throw new Error("placeholder left unreplaced");
fs.writeFileSync("index.html",out);
console.log("index.html:",(out.length/1024).toFixed(0),"KB");
'
