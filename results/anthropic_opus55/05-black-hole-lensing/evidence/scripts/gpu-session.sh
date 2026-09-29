#!/usr/bin/env bash
# Opens a headed Chrome session that uses the real GPU under WSL2 (Mesa d3d12 → ANGLE GL).
# Usage: source evidence/scripts/gpu-session.sh   (then use: ab <agent-browser args>)
export LD_LIBRARY_PATH=/usr/lib/wsl/lib:${LD_LIBRARY_PATH:-}
export GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
GPU_ARGS="--use-gl=angle,--use-angle=gl,--ignore-gpu-blocklist,--ozone-platform=x11"
ab() { agent-browser --session bhg --headed --args "$GPU_ARGS" "$@"; }
