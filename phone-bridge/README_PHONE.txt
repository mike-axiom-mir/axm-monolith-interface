AXM PHONE-LOCAL MONOLITH BRIDGE v0.1
====================================

WHAT THIS IS
------------
This is the phone equivalent of the collaboration-platform bridge.
It runs ON the Android phone, not on a laptop.

Normal path:

  AXM Mobile interface
          |
          v
  http://127.0.0.1:8787
  AXM Phone Monolith Bridge
          |
          +--> installed monolith identity/context
          +--> optional phone-local model
          +--> optional Claude API
          +--> optional OpenAI API

The bridge also serves the Mobile interface at:
  http://127.0.0.1:8787/

WHY
---
The phone UI is only the human surface. It does not need to contain an AI.
The bridge is the local doorway between that surface, the phone monolith, and
whatever intelligence route the user chooses.

MONOLITH
--------
The bridge does not copy or shrink the monolith. Point it at the monolith you
actually install on the phone.

Preferred:
  AXM_PHONE_MONOLITH_MANIFEST=/exact/path/to/axm-cartridge.json

Or point at an extracted monolith root:
  AXM_PHONE_MONOLITH_ROOT=/exact/path/to/monolith

The bridge checks these manifest names inside that root:
  axm-cartridge.json
  AXM_MONOLITH_MANIFEST.json
  monolith-manifest.json
  manifest.json

If none exists, the bridge reports the monolith as unidentified rather than
inventing capabilities. A manifest can also be installed into phone-state via
POST /monolith/install-manifest from an authorized local client.

INSTALL ON ANDROID
------------------
Practical foundation: Termux + Node.js.

1. Install a current Termux build.
2. Put this AXM_PHONE_MONOLITH_HOST folder on the phone / inside Termux storage.
3. In Termux, enter the phone-bridge folder.
4. Run:
     bash INSTALL_TERMUX.sh
5. Optionally copy phone.env.example to phone.env and set monolith/provider paths.
6. Start:
     ./START_PHONE_BRIDGE.sh
7. Open on the SAME phone:
     http://127.0.0.1:8787/

PROVIDERS
---------
None is mandatory.

PHONE LOCAL MODEL
  Set AXM_PHONE_LOCAL_URL to an OpenAI-compatible local server on the phone.

CLAUDE API
  Set ANTHROPIC_API_KEY and AXM_PHONE_CLAUDE_MODEL in the bridge environment.

OPENAI API
  Set OPENAI_API_KEY and AXM_PHONE_OPENAI_MODEL in the bridge environment.

API keys remain in the phone-side Node process. The browser UI does not need
to receive them.

SECURITY
--------
- Bridge defaults to 127.0.0.1 only: same phone.
- Browser access is accepted only from the bridge's own localhost origin.
- Non-browser machine clients use a generated token in phone-state.
- /ask is rate capped.
- phone-state/phone-bridge.log is append-only operational evidence.
- The bridge does not expose a shell or arbitrary filesystem endpoint.

ROUTES
------
GET  /                      phone human interface
GET  /health                bridge/provider/monolith status
GET  /monolith              identified manifest (authorized)
POST /monolith/install-manifest  install exact manifest (authorized)
POST /ask                   bounded conversation route (authorized)

NOT DONE / TRUTH BOUNDARY
-------------------------
- This foundation does not automatically execute arbitrary monolith capabilities.
- It does not claim a 448 MB+ desktop monolith body will run unchanged on every phone.
- A monolith manifest identifies capability truth; it does not prove each capability
  can execute on Android.
- Phone-native runtime adapters must be evidenced capability by capability.
- OpenAI API access is not the same thing as this exact ChatGPT conversation.
