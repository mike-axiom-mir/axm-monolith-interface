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

A device must not require another AXM device to remain powered, nearby, or reachable merely to use its own installed monolith. Cross-device links are optional peer/mesh composition between independently usable nodes.

## Phone flow

The primary phone architecture is:

```text
AXM Phone UI
    ↓
phone-local bridge (127.0.0.1:8787)
    ↓
phone-local monolith ZIP/body
    ↓
optional intelligence route
    ├─ OpenAI / chatgpt route (current primary)
    ├─ phone-local model
    ├─ Codex local seat (when actually installed)
    └─ Claude compatibility
```

Run the phone bridge and open `http://127.0.0.1:8787/` on that same phone. The page has a primary **Connect monolith ZIP** action.

The ZIP install path is staged and fail-closed:

1. Stream ZIP to phone storage instead of buffering the whole archive in memory.
2. Reject unsafe absolute / `..` paths and symlink entries.
3. Extract into a new staged monolith directory.
4. Search for a native AXM interface manifest.
5. Activate the new pointer only after extraction/validation succeeds.
6. Leave the previous active monolith untouched if import fails.

If a native manifest exists, its capability truth is used. If not, the archive is still connected through a bridge-owned **body-only adapter** with zero inferred capabilities. That preserves the body without pretending we know what can execute on Android.

## Provider slots

The bridge exposes distinct provider slots rather than merging everything called OpenAI into one identity:

- `chatgpt` — current OpenAI API route used by the bridge.
- `local` — optional phone-local OpenAI-compatible model.
- `codex` — reserved local Codex seat; currently reports unavailable until Codex actually exists on that phone.
- `claude` — optional compatibility route.

## Conversation

Conversation is the easiest human entry point on phone. Capability status, consent and evidence remain inspectable beside it. A conversation reply is never treated as proof that a capability executed.

## Tests

```bash
npm test
```

The test suite starts the real phone bridge, imports a ZIP with a native manifest, imports a body-only ZIP, checks activation state, and confirms chat fails closed when no intelligence provider is configured.
