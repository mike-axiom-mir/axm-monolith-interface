# AXM Monolith Interface

One repository, three first-class interface surfaces over one shared monolith truth:

- `human/` — desktop/tablet human workspace.
- `mobile/` — phone-human surfaces.
- `machine/` — structured JSONL surface for machine users.
- `shared/host-core.js` — shared cartridge, permission, evidence and action-proposal state.
- `shared/chat-transport.js` — bounded conversation transport.
- `phone-bridge/` — phone-local monolith bridge.
- `external-bridge/` — optional peer/inter-device compatibility path only; never a prerequisite for a device-local monolith.

## Device-local bridge invariant

**Wherever a monolith lives, its primary bridge lives on that same device.**

```text
phone monolith   -> phone-local bridge
laptop monolith  -> laptop-local bridge
mini-PC monolith -> mini-PC-local bridge
future device    -> that device's local bridge
```

A device must not require another user's device, a laptop on the same network, or another AXM host to remain powered and in range merely to use its own installed monolith.

Cross-device links are optional composition/mesh paths between independently usable nodes. They add collaboration or capability sharing; they are not the base runtime dependency.

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

## Optional inter-device route

`external-bridge/` remains only for the separate case where one independently usable AXM device explicitly chooses to communicate with another. It is optional peer connectivity, not the normal phone architecture and not a dependency chain.

## Truth boundary

The provider name `chatgpt` refers to an OpenAI API route. It is **not automatically this exact ChatGPT conversation or subscription session**.

## Tests

```bash
npm test
```

The test command covers shared human/machine capability truth, bounded conversation transport, and the phone-local bridge without requiring a live provider.
