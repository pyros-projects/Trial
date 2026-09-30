#!/bin/bash
# samples page health every 250ms while chorus.sh runs
export AGENT_BROWSER_SESSION=echoloop
for i in $(seq 1 600); do
  r=$(agent-browser eval "location.href.slice(-8)+' t='+(window.EchoLoop?EchoLoop.state().tick+' L'+EchoLoop.state().loopIndex+' '+EchoLoop.state().sessionState:'NOAPP')" 2>&1 | tail -1)
  echo "$(date +%T.%N | cut -c1-12) $r"
  grep -q DONE "$(dirname "$0")/chorus.log" 2>/dev/null && break
  sleep 0.25
done
