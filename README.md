# AXM Monolith Interface

One repository, three first-class interface surfaces over one shared monolith truth:

- `human/` — desktop/tablet human workspace.
- `mobile/` — phone-human surfaces.
- `machine/` — structured JSONL surface for machine users.
- `shared/host-core.js` — shared cartridge, permission, evidence and action-proposal state.
- `shared/chat-transport.js` — bounded conversation transport.
- `phone-bridge/` — **phone-local monolith bridge**; the normal mobile bridge path.
- `external-bridge/` — optional LAN companion for reaching the older collaboration-platform bridge; not required for the phone-local architecture.

## Phone is self-contained

The primary phone architecture is:

```text
AXM Phone UI
    ↓
phone-local bridge (127.0.0.1:8787)
    ↓
installed phone monolith identity/context
    ↓
optional intelligence route
    ├─ phone-local model
    ├─ Claude API
    └─ OpenAI API
```

The phone does **not** need a laptop bridge. The page is the human interface, while the bridge is the local doorway. It can keep provider keys outside the browser and can connect the conversation to an identified monolith.

Run the bridge and open `http://127.0.0.1:8787/`. The bridge serves `mobile/phone-local.html`, checks its own health, loads an identified monolith manifest if present, and unlocks chat only when both monolith identity and an intelligence route are real.

See `phone-bridge/README_PHONE.txt` for the Android/Termux setup.

## Large monolith boundary

The bridge stays tiny. It does not duplicate the full monolith body. Point `AXM_PHONE_MONOLITH_MANIFEST` at the exact phone monolith interface manifest, or set `AXM_PHONE_MONOLITH_ROOT` to an extracted monolith root.

If no known manifest exists, the bridge reports the monolith as **unidentified** instead of inventing capabilities. Installing a manifest through the phone UI stores only the manifest; it does not claim to copy or make the entire monolith Android-executable.

## Conversation

Conversation is the easiest human entry point, especially on phone. Capability status, permissions and evidence remain inspectable beside it. A conversation reply is never treated as proof that a capability executed.

## Optional old-platform LAN route

`external-bridge/` remains available for the different use case where another device needs to reach `axm-collaboration-platform/bridge/axm-bridge.js` across a LAN. That is no longer the primary phone design.

## Truth boundary

The provider name `chatgpt` refers to an OpenAI API route. It is **not automatically this exact ChatGPT conversation or subscription session**.

## Tests

```bash
npm test
```

The test command covers shared human/machine capability truth, bounded conversation transport, and syntax-checks the phone-local bridge without requiring a live provider.
