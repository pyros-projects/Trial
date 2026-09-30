#!/bin/bash
SP=$(cd "$(dirname "$0")" && pwd); AB=$SP/ab.sh; cd $SP
./face.sh Sun
$AB find role button click --name "Take sight ⤵" >/dev/null || echo "no take sight"
$AB wait 300 >/dev/null
./align.sh | grep logged | cut -c1-240
