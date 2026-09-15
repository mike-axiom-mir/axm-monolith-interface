#!/data/data/com.termux/files/usr/bin/bash
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
if [ -f "phone.env" ]; then
  set -a
  . ./phone.env
  set +a
fi
if [ -z "$AXM_PHONE_MONOLITH_ROOT" ] && [ -d "../phone-monolith" ]; then
  export AXM_PHONE_MONOLITH_ROOT="$(cd ../phone-monolith && pwd)"
fi
exec node ./axm-phone-bridge.js
