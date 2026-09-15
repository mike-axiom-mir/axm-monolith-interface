AXM PHONE-LOCAL MONOLITH BRIDGE v0.1.2
======================================

WHAT THIS IS
------------
This is the phone equivalent of the collaboration-platform bridge.
It runs ON the Android phone, not on a laptop.

Normal current path:

  AXM Mobile interface
          |
          v
  http://127.0.0.1:8787
  AXM Phone Monolith Bridge
          |
          +--> installed monolith identity/context
          +--> OpenAI route (provider id: chatgpt)  <-- primary now
          +--> optional phone-local model           <-- fallback/future
          +--> optional Claude compatibility        <-- dormant/not required

The bridge also serves the Mobile interface at:
  http://127.0.0.1:8787/

WHY
---
The phone UI is only the human surface. It does not need to contain an AI.
The bridge is the local doorway between that surface, the phone monolith, and
the configured intelligence route.

CURRENT PROVIDER PRIORITY
-------------------------
For the current setup the bridge prefers:

  1. chatgpt  -> OPENAI_API_KEY + AXM_PHONE_OPENAI_MODEL
  2. local    -> AXM_PHONE_LOCAL_URL (optional fallback)
  3. claude   -> compatibility only if explicitly configured

This matches the naming already used by the collaboration-platform bridge.
Important: its provider id `chatgpt` currently means an OpenAI API call. It is
not a spawned CLI process and not this exact cloud ChatGPT conversation/session.

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
2. Put the AXM monolith interface folder on the phone / inside Termux storage.
3. Put/extract the device monolith in sibling `phone-monolith/` or configure an exact path.
4. In Termux, enter the phone-bridge folder.
5. Run:
     bash INSTALL_TERMUX.sh
6. Copy phone.env.example to phone.env and configure OPENAI_API_KEY plus AXM_PHONE_OPENAI_MODEL.
7. Start:
     ./START_PHONE_BRIDGE.sh
8. Open on the SAME phone:
     http://127.0.0.1:8787/

PROVIDERS
---------
OPENAI / CHATGPT ROUTE — PRIMARY CURRENT PATH
  Set OPENAI_API_KEY and AXM_PHONE_OPENAI_MODEL in the bridge environment.

PHONE LOCAL MODEL — OPTIONAL
  Set AXM_PHONE_LOCAL_URL to an OpenAI-compatible local server on the phone.

CLAUDE — DORMANT COMPATIBILITY
  Supported only if ANTHROPIC_API_KEY and AXM_PHONE_CLAUDE_MODEL are supplied.
  It is not required by the current phone architecture.

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
- A monolith manifest identifies capability truth; it does not prove each capability can execute on Android.
- Phone-native runtime adapters must be evidenced capability by capability.
- OpenAI API access is not the same thing as this exact ChatGPT conversation.
