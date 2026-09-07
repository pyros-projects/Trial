#!/bin/bash
# Dump the live diagnostics object from the running app.
agent-browser --session "${1:-ero}" eval "JSON.stringify(window.__ERO.stats())" 2>&1
