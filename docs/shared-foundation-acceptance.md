# Portable rules boundary — completion audit

The portable game-core now contains game rules that accept plain values and return plain results. These are independent of character persistence, UI, and the session authority.

## Shared protocol contract status
- Session core operation and state types, base socket messages/decoder, character-sheet routing, dice rolls and logs are centralized in session-protocol.
- Feature envelopes cover lifecycle, ability, magic, custom systems, inventory, initiative, missions, race, class, profile, equipment and configuration.
- Domain-specific runtime validation and authorization remain in the Worker by design. They are **not** duplicate wire-contract authorities.
- Compatibility exports preserve the website's and Worker's existing API paths.

## Game core boundary
Portable: damage, HP, death saves, XP, bonuses, ASI, dice grammar, inventory math, item weight, weapon/attack-rider rules, rest and progression settings.
Host-owned: character persistence and `CharacterTemplate` mutation; formulas bound to a character; effect resolution involving inventory, class levels, active conditions and magic slots; session permissions and revision checks.

No blanket export or direct migration of every character orchestration method is intended: that would couple game-core to host models and violate the portable contract. Future domain rules can be extracted when their data contracts are isolated.

## Session-client boundary
The transport owns sockets, reconnect and heartbeat scheduling, session handshake and token retrieval, and stale-connection exclusion. A host supplies a decoder, typed messages, handlers and (optionally) a credential supplier. It does not own session state or authorization policy.

## Acceptance
CI checks game-core dependency boundaries, unit rules, protocol semantics, transport edge cases, frontend compilation and Worker typecheck. Live multiplayer testing is deliberately deferred.
