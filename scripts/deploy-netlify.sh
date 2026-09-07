#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

site_id=''
site_name=''
team=''
production=false
screenshots=auto
while [ "$#" -gt 0 ]; do
    case "$1" in
        --prod) production=true; shift ;;
        --site-id|--site-name|--team|--screenshots)
            option=$1
            [ "$#" -ge 2 ] || { printf 'Missing value for %s\n' "$option" >&2; exit 1; }
            case "$option" in
                --site-id) site_id=$2 ;;
                --site-name) site_name=$2 ;;
                --team) team=$2 ;;
                --screenshots) screenshots=$2 ;;
            esac
            shift 2 ;;
        --help|-h)
            printf '%s\n' 'Usage: sh scripts/deploy-netlify.sh [--prod] [--site-id ID | --site-name NAME] [--team SLUG] [--screenshots auto|none]'
            exit 0 ;;
        *) printf 'Unknown option: %s\n' "$1" >&2; exit 1 ;;
    esac
done
[ -z "$site_id" ] || [ -z "$site_name" ] || { printf '%s\n' 'Choose --site-id or --site-name, not both.' >&2; exit 1; }
[ -z "$team" ] || [ -n "$site_name" ] || { printf '%s\n' '--team is used only with --site-name.' >&2; exit 1; }
case "$screenshots" in auto|none) ;; *) printf '%s\n' '--screenshots must be auto or none.' >&2; exit 1 ;; esac
command -v netlify >/dev/null 2>&1 || { printf '%s\n' 'Install Netlify CLI with npm install -g netlify-cli, then run netlify login.' >&2; exit 1; }
if [ -n "${PYTHON:-}" ]; then
    python_bin=$PYTHON
elif command -v python3 >/dev/null 2>&1; then
    python_bin=python3
elif command -v python >/dev/null 2>&1; then
    python_bin=python
else
    printf '%s\n' 'Python 3.11 or newer is required. Set PYTHON to its executable path.' >&2
    exit 1
fi
if [ -z "$site_id" ] && [ -z "$site_name" ]; then
    site_id=${NETLIFY_SITE_ID:-}
    if [ -z "$site_id" ] && [ -f .netlify/state.json ]; then
        site_id=$("$python_bin" -c 'import json; print(json.load(open(".netlify/state.json", encoding="utf-8")).get("siteId") or "")')
    fi
fi
if [ -z "$site_id" ] && [ -z "$site_name" ]; then
    printf '%s\n' 'No target selected. Pass --site-id, set NETLIFY_SITE_ID, link an existing site with netlify link, or explicitly create one with --site-name.' >&2
    exit 1
fi
if [ -n "$site_name" ]; then
    "$python_bin" -c 'import re,sys; sys.exit(0 if re.fullmatch(r"[a-z0-9][a-z0-9-]{0,61}[a-z0-9]", sys.argv[1]) else "--site-name must contain 2-63 lowercase letters, numbers or interior hyphens.")' "$site_name"
fi
export CI=true NETLIFY_TELEMETRY_DISABLED=1
if [ -n "$site_name" ]; then unset NETLIFY_SITE_ID; fi
status_exit=0
status=$(netlify status --json) || status_exit=$?
printf '%s' "$status" | "$python_bin" -c '
import json,sys
status=json.load(sys.stdin)
if not status.get("loggedIn"):
    sys.exit("Netlify is not authenticated. Run netlify login and try again.")
if sys.argv[1] != "0" and (status.get("error") or {}).get("code") != "NOT_LINKED":
    sys.exit("Netlify status failed. Resolve the reported error before deploying.")
if sys.argv[2] and status.get("linked") and (status.get("siteData") or {}).get("site-name") != sys.argv[2]:
    sys.exit("This directory is linked to a different site. Use --site-id for an existing target, or run netlify unlink before creating a new site.")
' "$status_exit" "$site_name"
PYTHON=$python_bin sh scripts/build-site.sh --screenshots "$screenshots"
set -- deploy --dir dist/site --no-build --json --timeout 600
if [ -n "$site_id" ]; then set -- "$@" --site "$site_id"; fi
if [ -n "$site_name" ]; then set -- "$@" --site-name "$site_name"; fi
if [ -n "$team" ]; then set -- "$@" --team "$team"; fi
if [ "$production" = true ]; then set -- "$@" --prod; fi
exec netlify "$@"
