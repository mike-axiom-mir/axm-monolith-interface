AXM PHONE-LOCAL MONOLITH BRIDGE v0.2
====================================

WHAT THIS IS
------------
The phone equivalent of the collaboration-platform bridge. It runs ON Android
(Termux + Node), serves the phone interface, and owns the phone-local monolith
install/connection path.

Normal path:

  AXM Mobile interface
          |
          v
  http://127.0.0.1:8787
  AXM Phone Monolith Bridge
          |
          +--> active phone monolith ZIP/body
          +--> OpenAI route (provider id: chatgpt)  <-- current primary
          +--> optional phone-local model
          +--> Codex local seat when actually installed on phone
          +--> optional Claude compatibility

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
5. Optional: copy phone.env.example to phone.env and configure provider settings.
6. Start:
     ./START_PHONE_BRIDGE.sh
7. Open on the SAME phone:
     http://127.0.0.1:8787/
8. Press Connect monolith ZIP and choose the checkpoint ZIP.

CURRENT PROVIDER SLOTS
----------------------
chatgpt
  Current OpenAI API bridge route. Configure OPENAI_API_KEY and
  AXM_PHONE_OPENAI_MODEL.

local
  Optional phone-local OpenAI-compatible model. Configure AXM_PHONE_LOCAL_URL.

codex
  Distinct local Codex seat. It reports unavailable until Codex is actually
  installed/wired on this phone. It is NOT replaced by the API route.

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
- The provider id `chatgpt` currently means the OpenAI API route, not this exact
  cloud ChatGPT conversation.
