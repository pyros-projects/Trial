#!/usr/bin/env bash
set -o pipefail
TASK_ROOT="/home/pyro/projects/naked/astra/bench/03-modular-synth"
printf '%q ' agent-browser --session phase-synth "$@" >> "$TASK_ROOT/evidence/logs/browser-commands.log"
printf '\n' >> "$TASK_ROOT/evidence/logs/browser-commands.log"
agent-browser --session phase-synth "$@" 2>&1 | tee -a "$TASK_ROOT/evidence/logs/browser-output.log"
