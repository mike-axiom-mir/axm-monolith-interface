AXM EXTERNAL CHAT RELAY
=======================

Purpose
-------
Give the AXM phone/human interface a narrow way to talk to the existing
AXM platform bridge from another device on the same local network.

Architecture
------------
phone / human interface
        |
        |  external token required
        v
AXM external chat relay :8797
        |
        |  local platform token
        v
existing AXM platform bridge :8787
        |
        +--> local model / Claude API / OpenAI API

The relay deliberately exposes ONLY:
  GET  /health
  POST /ask

It does NOT expose shell access, arbitrary files, platform internals,
or other local bridge endpoints.

Use
---
1. Keep these exported files together with the platform bridge files.
2. Start the normal platform bridge first:
       node axm-bridge.js
3. Start the external relay:
       node axm-external-chat-relay.js
4. The relay prints one or more "Phone URL" addresses and an external token.
5. In AXM Mobile -> Machine link, enter the Phone URL and paste that token.
6. Test the link. Then chat.

Provider
--------
The existing bridge decides where the intelligence lives:
  local    -> local OpenAI-compatible model server
  claude   -> Anthropic API key on the host machine
  chatgpt  -> OpenAI API key on the host machine
  auto     -> bridge chooses an available provider

Truth boundary
--------------
This does NOT connect this exact cloud ChatGPT conversation by magic.
The existing "chatgpt" provider is an OpenAI API route. Preserving this exact
chat's live context would require a separate ChatGPT-facing connector/hosted
integration or explicit handoff packets.

Security
--------
- External relay is opt-in and token-locked.
- A new random external-token.txt is generated on first run.
- Keep external-token.txt private.
- Default port is 8797; change with AXM_EXTERNAL_PORT.
- Default listen host is 0.0.0.0 so phones on the LAN can reach it.
- Stop the relay when you do not want LAN access.
