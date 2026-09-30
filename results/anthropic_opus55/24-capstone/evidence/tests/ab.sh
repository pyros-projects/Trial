#!/bin/bash
export AGENT_BROWSER_NAMESPACE=starfix
exec agent-browser --session sf "$@"
