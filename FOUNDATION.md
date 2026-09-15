# FOUNDATION

## Purpose

`axm-monolith-interface` is the device/user-facing host layer for AXM monolith cartridges.

It deliberately separates **what exists** from **how a particular user interacts with it**.

A single connected monolith can therefore expose the same capability truth through:

- a spatial, inspectable human desktop workspace;
- a touch-first mobile human shell;
- a structured machine-native surface.

The interface family must not fork capability truth into incompatible stories.

## Shared state, different ergonomics

Human desktop can privilege overview, simultaneous panels, visual hierarchy, history and direct manipulation.

Human mobile can privilege focus, one-handed actions, progressive disclosure, quick switching and local continuity.

Machine users can privilege schemas, stable identifiers, state snapshots, bounded action requests, evidence receipts and deterministic parseable output.

These are different ergonomics over one underlying contract.

## Cartridge boundary

A cartridge may declare:

- identity and version;
- capabilities;
- evidence state for each capability;
- permissions it may need;
- surfaces it can propose;
- machine operations it can propose;
- personalization hints.

A declaration is not proof and loading is not authorization.

The host may inspect and render declarations before execution is available.

## Root gate

The internal constitutional merge gate remains:

1. Truth
2. Agency / non-domination
3. Continuity
4. Wisdom before speed

No founder, specialist, model, machine user, human user, Git permission or implementation shortcut replaces those roots as AXM's internal constitutional gate.

## Personalization

Personalization is allowed to change presentation, ordering, shortcuts, density and preferred flows.

It must not silently alter:

- evidence history;
- source identity;
- permission history;
- capability meaning;
- root decisions;
- provenance.

## Current implementation boundary

The first repository version is intentionally capable of discovery, inspection, permission-state handling, personalization state and structured action proposals.

It does **not** yet claim arbitrary cartridge execution. Action proposals remain explicit `not_executed` receipts until a real runtime adapter is wired and verified.
