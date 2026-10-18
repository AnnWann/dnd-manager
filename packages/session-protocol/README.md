# Session protocol

Cross-runtime TypeScript contracts shared by the website and Cloudflare session server.

This package must remain independent of React, browser APIs, Cloudflare APIs, Prisma, and game UI modules.

First migration: `InitiativeHpApplicationResult`. Future operations and messages should be migrated incrementally, preserving wire compatibility and behavior.

## Extracted protocol families

- Core live-session HP, conditions, rest, stats, hit dice, and logged operations: `sessionCore.ts`
- Client/server base socket message envelopes: `sessionMessages.ts` (generic dice payloads)
- Route mapping for character-sheet mutations: `sheetRoutes.ts`
- Initiative, inventory, missions and ownership-independent operation contracts
- Abilities, custom systems, spellcasting, equipment, profile, race, proficiency, custom classes, character lifecycle and runtime config

These are **type contracts**, not a second authority for session state. Website and Worker continue to validate and apply commands at their respective boundaries. Existing parsers and domain validators remain in place until they can be migrated with parity tests.

CI validates pure routing behavior, game-core rules, session-client behavior, website compilation and Worker type checking. Live integration testing remains intentionally deferred.

## Remaining deduplication

The Worker still maintains its own session actor runtime state and some specialized protocol/validator types, while the website retains dice-roll and log-specific types. Those should be reconciled against the shared contracts without weakening existing runtime validation.
