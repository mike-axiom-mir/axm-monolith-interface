#!/data/data/com.termux/files/usr/bin/bash
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
if [ -f "phone.env" ]; then
  set -a
  . ./phone.env
  set +a
fi
exec node ./axm-phone-bridge.js
