# AXM Monolith Interface Foundation

## Purpose

Provide stable device/user-facing interfaces that can load changing AXM monolith cartridges without baking the monolith into the UI.

## Interface family

Human desktop/tablet, phone-human, and machine-native users are different interaction surfaces over one shared state/contract. Presentation may diverge; capability identity, permission decisions, evidence and action truth may not silently diverge.

## Conversation is the front door

Especially on phone, a human should not need to understand capability registries before they can begin. Once a monolith identity and machine route are connected, the default surface is conversation. The chat layer is transport-agnostic: the machine can live locally, behind the platform bridge, or eventually behind another verified monolith-native transport.

The interface must never imply that intelligence lives inside the page merely because a conversation is displayed there.

## External bridge boundary

The existing collaboration-platform bridge remains loopback-only. A separate optional external relay may expose only the minimum conversation endpoints needed by another device. That relay must be token-locked, rate-bounded, auditable, and must not become a general shell/filesystem door.

## Four roots

Truth, Agency/non-domination, Continuity, and Wisdom before speed remain the internal constitutional merge gate.

Operational consequences include:

- declared capability is not verified capability;
- connection is not consent;
- a proposed action is not an executed action;
- conversation output is not evidence that a tool/action ran;
- personalization may reshape presentation but not silently rewrite source truth;
- external connectivity stays narrow and explicit.
