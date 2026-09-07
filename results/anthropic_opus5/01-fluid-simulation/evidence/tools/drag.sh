#!/usr/bin/env bash
# drag.sh <session> <x0> <y0> <x1> <y1> <steps>
S=$1; X0=$2; Y0=$3; X1=$4; Y1=$5; N=$6
agent-browser --session "$S" mouse move "$X0" "$Y0" >/dev/null 2>&1
agent-browser --session "$S" mouse down >/dev/null 2>&1
for i in $(seq 1 "$N"); do
  X=$(( X0 + (X1 - X0) * i / N ))
  Y=$(( Y0 + (Y1 - Y0) * i / N ))
  agent-browser --session "$S" mouse move "$X" "$Y" >/dev/null 2>&1
done
agent-browser --session "$S" mouse up >/dev/null 2>&1
