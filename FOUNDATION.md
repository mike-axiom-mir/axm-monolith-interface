# AXM Monolith Interface Foundation

## Purpose

Provide stable device/user-facing interfaces that can load changing AXM monolith cartridges without baking the monolith into the UI.

## Interface family

Human desktop/tablet, phone-human, and machine-native users are different interaction surfaces over one shared state/contract. Presentation may diverge; capability identity, permission decisions, evidence and action truth may not silently diverge.

## Device-local bridge invariant

Wherever a monolith is installed, its primary bridge is co-located on that same device.

`device interface -> device-local bridge -> device monolith -> optional intelligence route`

A local monolith must remain usable without requiring another AXM device to be powered, nearby, reachable, or acting as its bridge. Cross-device connectivity is optional composition between autonomous nodes, not a hidden dependency chain.

## Phone-local bridge

The primary mobile architecture is local to the phone:

`phone human interface -> phone-local bridge -> installed monolith -> optional intelligence route`

The phone interface is not required to contain an AI. The bridge is the phone's local doorway and defaults to loopback-only `127.0.0.1`. It may connect to a phone-local model or an explicitly configured remote AI API while keeping provider keys outside the browser UI.

The bridge must remain small and must not duplicate the monolith body. Monolith identity/capability truth comes from an exact installed manifest. If that manifest is unavailable, the bridge reports the monolith as unidentified instead of inferring capabilities from filenames or size.

## Conversation is the front door

Especially on phone, a human should not need to understand capability registries before beginning. When a monolith identity and intelligence route are connected, conversation is the default human surface. Capability, permission and evidence views remain inspectable alongside it.

The interface must never imply that intelligence lives inside the page merely because conversation is displayed there. Conversation output is not execution evidence.

## Other bridge paths

Inter-device bridges and relays are optional peer links between independently usable AXM nodes. They may provide collaboration, handoff, mesh participation, capability sharing, or remote seats. They must not silently become the authority source or base runtime requirement for another device's local monolith.

## Four roots

Truth, Agency/non-domination, Continuity, and Wisdom before speed remain the internal constitutional merge gate.

Operational consequences include:

- declared capability is not verified capability;
- connection is not consent;
- a proposed action is not an executed action;
- conversation output is not evidence that a tool/action ran;
- personalization may reshape presentation but not silently rewrite source truth;
- external connectivity stays narrow and explicit;
- Android compatibility is evidenced capability by capability, not assumed from desktop monolith membership;
- device-local operation remains the default; mesh/peer links are additive rather than required.
