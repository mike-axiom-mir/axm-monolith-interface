# AXM Monolith Interface

Universal host/interface family for plugging AXM monolith cartridges into human and machine-facing surfaces.

## First-class surfaces

- `human/` — desktop and tablet human workspace.
- `mobile/` — phone-first human workspace.
- `machine/` — structured machine-native interface; no visual UI assumptions.
- `shared/` — common host core and root/consent logic used by every surface.
- `contracts/` — cartridge and host-state contracts.
- `examples/` — local test cartridges.

All three surfaces consume the same cartridge contract. A capability may be presented differently per surface, but it must not silently become a different capability.

## Architecture

```text
AXM monolith cartridge
        |
        v
shared cartridge + host contract
   /            |             \
  v             v              v
human        mobile         machine
workspace    touch shell    structured API
```

## Founding boundaries

1. The interface is a host, not the monolith itself.
2. Loading a cartridge does not authorize arbitrary execution.
3. Declared capability is not the same as verified capability.
4. Human and machine users are first-class users of the same underlying capability system.
5. Human and machine presentations may differ because their useful interfaces differ.
6. Personalization changes presentation and preferred workflows, not historical evidence or source truth.
7. Offline/local operation remains the default unless a capability explicitly requires and receives permission for something else.
8. Truth, Agency / non-domination, Continuity, and Wisdom before speed remain the internal constitutional merge gate.

## Open locally

- Desktop/tablet human: `human/index.html`
- Phone human: `mobile/index.html`
- Machine: `node machine/host.mjs examples/demo-cartridge.json snapshot`
- Root chooser: `index.html`

No package installation or build step is required for the initial human interfaces. The machine CLI requires a reasonably modern Node.js runtime.

## Current truth state

This repository is an interface foundation. It loads and inspects cartridge manifests and exposes them through three interface forms. It is **not yet a fully wired AXM Connected Monolith runtime** and does not claim that it can execute every declared monolith capability.
