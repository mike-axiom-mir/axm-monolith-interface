#!/data/data/com.termux/files/usr/bin/bash
set -e
printf '\nAXM Phone Monolith Bridge — Termux setup\n\n'
pkg update -y
pkg install -y nodejs unzip
chmod +x ./START_PHONE_BRIDGE.sh
mkdir -p ../phone-state ../phone-state/incoming ../phone-state/monoliths ../phone-state/adapters
printf '\nReady.\nStart with: ./START_PHONE_BRIDGE.sh\nThen open: http://127.0.0.1:8787/\n\n'
