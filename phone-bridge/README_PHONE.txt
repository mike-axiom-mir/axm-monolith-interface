AXM PHONE-LOCAL MONOLITH BRIDGE v0.3
====================================

WHAT THIS IS
------------
The phone equivalent of the collaboration-platform bridge. It runs ON Android
(Termux + Node), serves the phone interface, owns the phone-local monolith
install/connection path, and can use a locally logged-in Codex CLI seat.

Normal path:

  AXM Mobile interface
          |
          v
  http://127.0.0.1:8787
  AXM Phone Monolith Bridge
          |
          +--> active phone monolith ZIP/body
          +--> Codex CLI seat (preferred when installed + logged in)
          +--> optional OpenAI API route
          +--> optional phone-local model
          +--> optional Claude compatibility

CODEX CLI SEAT
--------------
The bridge looks for `codex` (or AXM_CODEX_BINARY) and runs:

  codex login status

The Codex seat is marked READY only when that command proves a logged-in state.
For a first phone test, try the official npm install path:

  npm install -g @openai/codex
  codex

Choose Sign in with ChatGPT, finish the browser login, then check:

  codex login status

Reload the AXM phone page. If Codex works on the phone, it becomes the preferred
provider automatically. If the binary cannot run on Android/Termux, the bridge
reports Codex unavailable without breaking the monolith or other provider slots.

For conversation requests the bridge invokes Codex non-interactively with:
- read-only sandbox
- ephemeral session
- no Git-repository requirement
- active monolith directory as its working directory

So Codex can inspect the connected monolith body during chat but the chat seat is
not allowed to silently modify it.

CONNECT A MONOLITH ZIP
----------------------
Open the phone page and press:

  Connect monolith ZIP

The bridge then:

1. Streams the ZIP to disk (large archives are not intentionally buffered whole in JS memory).
2. Rejects unsafe archive paths and ZIP symlink entries.
3. Extracts into a NEW staged monolith directory.
4. Searches for:
     axm-cartridge.json
     AXM_MONOLITH_MANIFEST.json
     AXM_TOTALITY_MANIFEST.json
     monolith-manifest.json
     manifest.json
5. Activates the new monolith pointer only after staging succeeds.
6. Keeps the previous monolith untouched if import fails.

If no native interface manifest exists, the archive still installs using a
bridge-owned BODY-ONLY adapter with zero invented capabilities. The UI clearly
labels that state.

INSTALL ON ANDROID
------------------
1. Install a current Termux build.
2. Put the AXM monolith interface folder on the phone / inside Termux storage.
3. In Termux enter `phone-bridge/`.
4. Run:
     bash INSTALL_TERMUX.sh
   This installs Node.js plus unzip/zipinfo tooling.
5. Try installing/logging into Codex as above.
6. Optional: copy phone.env.example to phone.env for binary/model/provider overrides.
7. Start:
     ./START_PHONE_BRIDGE.sh
8. Open on the SAME phone:
     http://127.0.0.1:8787/
9. Press Connect monolith ZIP and choose the AXM monolith ZIP.

CURRENT PROVIDER SLOTS
----------------------
codex
  Preferred local seat. Uses the device's own Codex CLI authentication. No
  OPENAI_API_KEY is required when Codex itself is logged in with ChatGPT.

chatgpt
  Separate OpenAI API route. Configure OPENAI_API_KEY and AXM_PHONE_OPENAI_MODEL.

local
  Optional phone-local OpenAI-compatible model. Configure AXM_PHONE_LOCAL_URL.

claude
  Compatibility only if explicitly configured. Not required.

ROUTES
------
GET  /                              phone human interface
GET  /health                        bridge/provider/active-monolith status
GET  /monolith                      active interface manifest (authorized)
POST /monolith/install-manifest     install an exact manifest (authorized)
POST /monolith/install-zip          stream/stage/activate a monolith ZIP (authorized)
POST /ask                           bounded conversation route (authorized)

STATE / CONTINUITY
------------------
phone-state/active-monolith.json stores the active pointer.
phone-state/monoliths/ contains staged extracted bodies.
phone-state/adapters/ contains explicit body-only interface adapters when needed.
phone-state/phone-bridge.log is append-only operational evidence.

The bridge does not automatically delete the previous extracted monolith when a
new one activates. That is intentional continuity/rollback preservation for now.

TRUTH BOUNDARY
--------------
- Archive installation does not prove every contained capability runs on Android.
- Native manifest capability status is preserved rather than upgraded by import.
- Body-only import invents zero capabilities.
- Conversation output is not execution evidence.
- Codex CLI readiness means the local binary is accessible and login status is
  verified; it does not prove native Android compatibility beyond the operations
  actually tested on the phone.
- The provider id `chatgpt` remains the separate OpenAI API route.
