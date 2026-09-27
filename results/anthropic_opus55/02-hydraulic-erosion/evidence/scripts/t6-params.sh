#!/usr/bin/env bash
# Same terrain, same simulated time (t >= 60 s); only one slider changed via real keyboard (focus + Home/End).
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
run() { # $1 slider id, $2 key (Home|End), $3 label
  $AB click "[data-preset=mountain]" >/dev/null; $AB wait 800 >/dev/null
  $AB focus "#$1" >/dev/null; $AB press $2 >/dev/null
  $AB click "#btnReset" >/dev/null
  $AB wait --fn "lab.S.time >= 60" --timeout 240000 >/dev/null
  $AB click "#btnPause" >/dev/null
  $AB eval "(()=>{const S=lab.S, st=lab.stats; return JSON.stringify({run:'$3', param:'$1='+lab.P['$1'.slice(2)], t:+S.time.toFixed(2), water_m3:+st.water.toFixed(0), wetPct:+(st.wetFrac*100).toFixed(1), suspended_m3:+st.sediment.toFixed(0), eroded_m3:+S.bal.eroded.toFixed(0), deposited_m3:+S.bal.deposited.toFixed(0), evaporated_m3:+S.bal.evap.toFixed(0), maxDelta_m:+st.maxDelta.toFixed(2), massRel:st.matRel.toExponential(1), waterRel:st.waterRel.toExponential(1)})})()"
  $AB screenshot "evidence/screenshots/20-param-$3.png" >/dev/null
  $AB click "#btnPause" >/dev/null
}
run p-erosion Home erosion-0
run p-erosion End erosion-3
run p-evaporation Home evaporation-0
run p-evaporation End evaporation-10
