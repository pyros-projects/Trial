#!/bin/bash
SP=$(cd "$(dirname "$0")" && pwd); AB=$SP/ab.sh
$AB find role tab click --name "Star planner" >/dev/null
$AB scrollintoview "#panePlanner tr[data-body=\"$1\"]" >/dev/null
$AB click "#panePlanner tr[data-body=\"$1\"]" >/dev/null
$AB wait 300 >/dev/null
