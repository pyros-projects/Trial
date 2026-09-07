#!/bin/bash
# Real pointer drag through the CDP input pipeline.
# usage: drag.sh <session> <x1> <y1> <x2> <y2> [steps] [button] [holdms]
S=$1; X1=$2; Y1=$3; X2=$4; Y2=$5; N=${6:-14}; B=${7:-left}; HOLD=${8:-0}
cmds="[[\"mouse\",\"move\",\"$X1\",\"$Y1\"],[\"mouse\",\"down\",\"$B\"]"
for i in $(seq 1 $N); do
  X=$(python3 -c "print(round($X1+($X2-$X1)*$i/$N))")
  Y=$(python3 -c "print(round($Y1+($Y2-$Y1)*$i/$N))")
  cmds="$cmds,[\"mouse\",\"move\",\"$X\",\"$Y\"]"
done
if [ "$HOLD" != "0" ]; then cmds="$cmds,[\"wait\",\"$HOLD\"]"; fi
cmds="$cmds,[\"mouse\",\"up\",\"$B\"]]"
echo "$cmds" | agent-browser --session "$S" batch >/dev/null 2>&1
echo "drag $B ($X1,$Y1)->($X2,$Y2) done"
