#!/bin/bash
exec agent-browser --session sdf-sol61-08-no-webgl --allowed-domains 127.0.0.1,localhost --args '--disable-webgl' "$@"
