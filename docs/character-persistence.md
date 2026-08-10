# Character persistence ownership

Character UI state remains optimistic and represented as `CharacterTemplate`, but remote persistence is split into explicit ownership domains. New code must not treat a character as one indivisible JSON document.

## Domain map

The same logical domains are used by authenticated characters and campaign/sync characters:

| Domain | Ownership |
| --- | --- |
| `sheet` | attributes, skills, proficiencies, classes, race and static sheet data |
| `vitals` | HP, conditions, death saves and turn-action state |
| `profile` | character profile/presentation data |
| `abilities` | ordinary character abilities/features |
| `magic` | spells, slots, metamagic, invocations and other magic state |
| `inventory` | carried/stored inventory |
| `equipment` | equipped items and equipment slots |
| `progression` | ASI/feats and progression migration metadata |
| `notes` | character notes |

An operation that legitimately moves data between domains, such as stowing an equipped item into inventory, is a cross-domain operation and must not pretend to be owned by only one domain.

## Authenticated `/user` characters

The Prisma `Character` row is the aggregate root. It owns:

- id;
- authenticated owner;
- name;
- visibility;
- root revision.

`Character.data` remains only as a legacy/bootstrap snapshot. Normal sheet edits no longer replace it.

Prisma domain rows live in `user_character_domain_state` through `CharacterDomainState`. Each `(characterId, domain)` has its own `revision`. Mutations are logged in `user_character_domain_mutation` through `CharacterDomainMutation`.

The API boundary is:

- root identity: `/api/me/characters/:characterId`;
- owned data: `/api/me/characters/:characterId/domains/:domain`.

`UserCharacterWorkspace` hydrates the legacy snapshot with domain rows, bootstraps any missing domains once, then delegates writes to `UserCharacterDomainPersistence`. Character-only edits therefore no longer call the legacy whole-document PATCH in normal authenticated usage.

The whole-document `updateMyCharacter()` API remains only for local-auth bypass and backward compatibility. New UI code should not call it.

## Campaign/sync characters

The relational `characters` row is the aggregate root for the sync-key/campaign storage model. It owns only data needed to identify/list a character:

- relational id and legacy/application id;
- name;
- owner key;
- visibility;
- character type;
- unique flag;
- root optimistic-concurrency version.

Route: `api/v2/characters.ts`.

Campaign domain rows live in `character_domain_state` and use named write routes:

| Domain | Route |
| --- | --- |
| `sheet` | `/api/v2/character-sheet` |
| `vitals` | `/api/v2/character-vitals` |
| `profile` | `/api/v2/character-profile` |
| `abilities` | `/api/v2/character-abilities` |
| `magic` | `/api/v2/character-magic` |
| `inventory` | `/api/v2/character-inventory` |
| `equipment` | `/api/v2/character-equipment` |
| `progression` | `/api/v2/character-progression` |
| `notes` | `/api/v2/character-notes` |

`/api/v2/character-domains` is the collection/read endpoint and is not intended to replace the named write routes in feature code.

`CharacterRelationalPersistenceBridge` currently provides transitional write-through from the existing campaign `AppState`. It diffs `CharacterTemplate` snapshots and writes only changed relational domains.

The old `/api/state` campaign snapshot still exists for compatibility and initial migration. It must not receive new character-specific business logic. A later relational-hydration cutover can remove character payloads from `/api/state` without changing this domain model.

## Concurrency

Every character domain has its own monotonically increasing version/revision. A write sends `expectedVersion`; stale writes receive HTTP 409 with the current domain instead of silently overwriting it.

Writes carry stable client/mutation metadata:

- `mutationId` identifies one logical mutation and makes retries idempotent;
- `clientId` identifies the browser/client instance;
- campaign writes also record `actorKey`;
- authenticated writes record the session user as the actor.

Mutation ids are reused on retry. Successful mutations are recorded in a change-log table.

Two clients can therefore edit different domains without sharing a character-wide revision. A future collaboration layer can make entities inside a domain more granular without changing the top-level ownership model.

## Client ownership API

For campaign CharacterContext code, prefer:

```ts
updateCharacterDomain(characterId, "magic", updater)
```

instead of generic `updateCharacter`. The context checks which domains actually changed and warns when an updater claims one owner but modifies another domain.

Use generic/cross-domain operations for actions that truly span owners, such as moving an item from equipment into inventory.

For authenticated characters, `UserCharacterDomainPersistence` performs the same domain diffing automatically around the existing `CharacterWorkspace` update API.

## Migrations

Campaign relational storage:

```text
database/migrations/002_character_domain_ownership.sql
```

Authenticated Prisma storage:

```text
prisma/migrations/20260810110000_character_domain_ownership/migration.sql
```

The relational migration is applied by the existing `npm run db:migrate` command. The Prisma migration must be applied by the deployment/database migration process used for the authenticated schema before the generated client is used with the new domain models.
