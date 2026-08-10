# Character persistence ownership

Character UI state is still optimistic and represented as `CharacterTemplate`, but remote persistence is no longer treated as one indivisible character document.

## Aggregate root

`characters` owns only data needed to identify, list and authorize a character:

- relational `id` and legacy/application id;
- name;
- owner key;
- visibility;
- character type;
- unique flag;
- root optimistic-concurrency version.

Route: `api/v2/characters.ts`.

## Owned domains

Each character domain has its own row and version in `character_domain_state`.

| Domain | Route | Ownership |
| --- | --- | --- |
| `sheet` | `/api/v2/character-sheet` | attributes, skills, proficiencies, classes, race and static sheet data |
| `vitals` | `/api/v2/character-vitals` | HP, conditions, death saves and turn-action state |
| `profile` | `/api/v2/character-profile` | character profile/presentation data |
| `abilities` | `/api/v2/character-abilities` | ordinary character abilities/features |
| `magic` | `/api/v2/character-magic` | spells, slots, metamagic, invocations and other magic state |
| `inventory` | `/api/v2/character-inventory` | carried/stored inventory |
| `equipment` | `/api/v2/character-equipment` | equipped items and equipment slots |
| `progression` | `/api/v2/character-progression` | ASI/feats and progression migration metadata |
| `notes` | `/api/v2/character-notes` | character notes |

`/api/v2/character-domains` is the collection/read endpoint and is not intended to replace the named write routes in feature code.

## Concurrency

Every `(character_id, domain)` row has its own monotonically increasing `version`. A write sends `expectedVersion`; stale writes receive HTTP 409 with the current row instead of silently overwriting it.

Writes also accept `mutationId`, `actorKey` and `clientId`. Successful mutations are recorded in `character_domain_change_log`, and duplicate mutation ids are idempotent.

This means two collaborators can modify different domains without sharing one character-wide revision. More granular entity-level mutation APIs can later be added inside a domain without changing the top-level ownership model.

## Client write flow

`CharacterRelationalPersistenceBridge` observes optimistic `AppState` character changes, diffs the previous and next `CharacterTemplate`, and queues only the affected domain routes. Queues are isolated per `(character, domain)` so rapid updates are serialized without blocking unrelated domains.

`CharacterContext.updateCharacterDomain(characterId, domain, updater)` is the preferred mutation API for new UI code. It checks that the updater did not modify fields owned by another domain. `updateCharacter` remains temporarily for legacy/cross-domain operations.

## Legacy state

`/api/state` remains a compatibility/cache synchronization layer during migration. It should not receive new character-specific business logic. The relational domain routes are the new persistence ownership boundary. Once relational hydration replaces the remaining legacy character bootstrap, the character payload can be removed from `/api/state` without another data-model redesign.

## Database migration

Run the normal migration command so `database/migrations/002_character_domain_ownership.sql` is applied before relying on the domain APIs.
