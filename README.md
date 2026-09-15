# AXM Monolith Interface

One repository, three first-class interface surfaces over one shared monolith truth:

- `human/` — desktop/tablet human workspace.
- `mobile/` — phone-first human conversation seat.
- `machine/` — structured JSONL surface for machine users.
- `shared/host-core.js` — shared cartridge, permission, evidence and action-proposal state.
- `shared/chat-transport.js` — bounded conversation transport used by human, phone and machine surfaces.
- `external-bridge/` — narrow LAN relay for the existing AXM collaboration-platform bridge.

## Start with conversation

The mobile interface does **not** contain or require a direct AI. Its startup model is:

1. Open the interface.
2. Connect/load a monolith cartridge so identity and capability context are known.
3. Configure or auto-probe a machine route.
4. Chat becomes the front door.
5. Capability, permission and evidence views remain available beside the conversation.

The intelligence may live in the connected monolith, a local model, or an AI provider behind the AXM platform bridge. The UI is a seat/control surface, not the mind itself.

## Existing platform bridge

`mike-axiom-mir/axm-collaboration-platform/bridge/axm-bridge.js` stays local-only on `127.0.0.1:8787` and owns provider keys. The optional external relay in this repo listens separately and forwards only `/health` and `/ask` after a token check. It does not expose shell access, arbitrary files, or the rest of the platform bridge.

For a phone on the same LAN, run the platform bridge, then the external relay, then enter the relay URL and external token in Mobile → Machine link settings.

## Truth boundary

The bridge provider named `chatgpt` is an OpenAI API route. It is **not automatically this exact ChatGPT conversation or subscription session**. Preserving a live ChatGPT conversation would require a separate ChatGPT-facing connector/hosted integration or explicit handoff packets.

## Tests

```bash
npm test
```

The tests cover shared human/machine capability truth and the bounded conversation transport without requiring a live AI provider.
