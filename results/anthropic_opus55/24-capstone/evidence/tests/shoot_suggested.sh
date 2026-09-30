#!/bin/bash
SP=$(cd "$(dirname "$0")" && pwd); AB=$SP/ab.sh; cd $SP
SUG=$(echo '[...document.querySelectorAll("#panePlanner tr[data-body]")].filter(t=>t.querySelector(".tag")).map(t=>t.dataset.body).join(",")' | $AB eval --stdin | tr -d '"'); echo "suggested: $SUG"
IFS=, read -ra BS <<< "$SUG"; for b in "${BS[@]}"; do ./face.sh "$b"; ./sight.sh "$b" | grep -E "logged|no take" | cut -c1-230; done
