# shared helpers for the Starfix e2e evidence scripts (bash; requires agent-browser 0.31 + node + uv)
T=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); E=$(dirname "$T"); SHOTS=$E/screenshots; AB=$T/ab.sh
URL=${URL:-http://127.0.0.1:${PORT:-51257}/index.html}
q(){ echo "$1" | $AB eval --stdin | tr -d '"\\'; }
shot(){ $AB screenshot "$SHOTS/$1" >/dev/null && echo "  [screenshot] screenshots/$1"; }
tab(){ $AB find role tab click --name "$1" >/dev/null; }
clickSel(){ $AB scrollintoview "$1" >/dev/null 2>&1; $AB click "$1" >/dev/null; }
adopt(){ tab "Sights & fix"; $AB find role button click --name "$1" >/dev/null; }
setcrs(){ tab "Helm & time"; $AB scrollintoview "#inCourse" >/dev/null; $AB fill "#inCourse" "$1" >/dev/null; $AB press Tab >/dev/null; $AB wait 150 >/dev/null; }
fresh(){ $AB open "$URL?e2e=$RANDOM" >/dev/null; $AB wait 700 >/dev/null; }
summary(){ q "JSON.stringify($1(starfix.summary()))"; }
