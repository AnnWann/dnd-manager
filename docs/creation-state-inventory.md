# Creation state inventory

This document records the data boundary behind the MASTER `creation/*` routes as Creation moves to one revisioned snapshot/draft/PATCH model.

## Scope boundary

`CreationState` is the persistent campaign configuration authored from Creation. It is not synonymous with every screen rendered under `/session/:campaignId/creation/*`.

The following remain outside the draftable Creation document:

- campaign membership and role administration;
- pending approval/request workflow;
- audit metadata (`createdAt`, `updatedAt`, `createdBy`, etc.);
- transient UI state;
- live gameplay state such as HP, resources, inventories, conditions, initiative and missions.

## Canonical Creation domains

The canonical state contains:

- character configuration;
- campaign spell definitions;
- item compendium entries;
- creature compendium entries;
- custom-system definitions.

Character configuration deliberately contains only Creation-owned settings: owner, type, visibility, uniqueness, hidden tabs and custom-system configuration. Full character snapshots are not part of `CreationState`, because they also contain mutable gameplay state.

## Editor architecture

The `creation/*` route subtree owns exactly one `CreationEditorProvider`. It loads:

- `base` — the canonical saved snapshot;
- `draft` — the editable copy;
- `baseRevision` — the revision used for optimistic concurrency;
- `managedDomains` — migration metadata for domains that previously lived in independent stores.

All Creation-owned editor mutations target `draft`. The explicit Save action sends the complete draft and `baseRevision` to the canonical PATCH endpoint. Discard restores the draft from `base` without performing persistence.

The migrated editor domains are:

- character configuration from `creation/settings`;
- item compendium from `creation/items-compendium`;
- creature compendium from `creation/creatures-compendium`;
- custom-system definitions from `creation/custom-systems/*`;
- campaign spell definitions from `creation/magic`.

Membership/role administration and request approval remain immediate because they are workflow/administration rather than Creation document editing.

## Canonical persistence

`GET /api/campaigns/:campaignId/creation` assembles the canonical `CreationSnapshot`.

`PATCH /api/campaigns/:campaignId/creation` validates MASTER access and the supplied `baseRevision`, then persists the Creation-owned domains in one Prisma transaction. A stale revision is rejected with `409 CREATION_REVISION_CONFLICT`.

Character persistence merges Creation-owned fields into the latest stored character JSON instead of replacing the whole character. This preserves concurrent live HP, resources, inventory, conditions and other gameplay state.

Campaign-owned spell, creature and custom-system definitions are persisted as `CampaignHomebrewAsset` rows using the domain types `SPELL`, `CREATURE` and `SYSTEM`. A `CREATION_STATE/v1` marker distinguishes a canonical, intentionally empty domain from a domain that has not yet crossed from legacy persistence.

Before the first canonical save, approved campaign spell links remain the fallback source for spells. The creature compendium adapter can seed its old browser-local content into the draft so the first canonical save migrates it rather than silently dropping it. Custom-system editor mutations no longer invoke the old auto-save path while inside Creation.

## Runtime projection

`src/shared/session-runtime/sessionRuntimeConfig.ts` defines:

- `SessionRuntimeConfig`;
- `SessionRuntimeConfigSnapshot`;
- `toSessionRuntimeConfig()`;
- `toSessionRuntimeConfigSnapshot()`.

The runtime projection includes only configuration needed by authoritative gameplay validation:

- reduced character configuration and ownership;
- spell definitions;
- custom-system definitions.

It excludes hidden tabs, item/creature authoring compendia, workflow records and all live gameplay state.

`SessionRuntimeConfigSnapshot` carries the saved `creationRevision` with that projection. The database remains authoritative for Creation. The Session Server stores only the latest published revision as a validation cache.

## Session Server runtime-config integration

The final authoritative Durable Object boundary owns the cached `runtime-config-state`.

The MASTER publishes saved configuration with `session.config.publish`. Dirty editor state is never published. The server rejects stale revisions and rejects different payloads claiming the same revision. Every participant receives `session.config.snapshot` when connecting and whenever a newer revision is accepted.

Character mutation authorization is performed before routing into gameplay domain actors:

- MASTER remains authoritative and can operate any character;
- PLAYER operations require a published runtime config;
- the target character must exist in the active Creation configuration;
- the PLAYER must match the saved `ownerId` from Creation.

This means authorization no longer depends only on mutable live HP/character snapshots.

Runtime config visibility is participant-specific. MASTER receives every character configuration. A PLAYER receives their own characters plus characters marked `party`; other players' `private` characters and MASTER-only characters are removed from the config snapshot sent to that client.

The same visibility rule now applies to live authoritative character state. Each WebSocket attachment stores the character ids visible to that participant for the active Creation revision. HP, conditions, abilities and character-lifecycle snapshots and incremental updates are filtered per recipient before they are written to the socket. Domain actors use a visibility-filtered Durable Object context for outbound broadcasts, so equipment, magic, proficiency, race and profile operations cannot bypass the same boundary when they emit character state.

When a newer Creation revision is accepted, the server recalculates every connection's visible character set and immediately re-sends filtered HP, conditions, abilities and lifecycle snapshots. This is important when a character changes from `party` to `private` or `master`, or is removed from Creation: clients replace their local authoritative maps with the newly filtered snapshots instead of retaining stale character data until reconnect.

Homebrew spell installation is also validated against Creation. `character.spell.add` with `homebrew: true` is accepted only when its spell index exists in the active saved runtime config. Official spells are intentionally not subject to this lookup because official definitions are not owned by Creation.

Custom-system field and resource mutations are now authoritative as well. The session workspace derives semantic operations from local UI changes instead of persisting whole-character mutations. The Session Server requires the referenced `systemId` to exist in the active runtime config, requires that exact system/version to be installed and enabled for the target character in Creation, and requires matching enabled live runtime state. It then delegates field/resource validation to the existing `CustomSystemState` rules, including edit permissions, required fields, value constraints, resource min/max rules and manual-adjustment permissions. Accepted mutations produce one semantic log record, an undo snapshot and a visibility-filtered authoritative character update.

Custom-system installation/enabling remains Creation configuration, not gameplay. A session operation cannot install a system or change its configured version/enabled flag.

The runtime-config wire parser validates revision shape, character configuration, spell identifiers, custom-system identifiers and duplicate ids before the Durable Object accepts a publish.

## Next migration work

The next custom-system live-state boundary is custom abilities. Ability creation/removal, custom ability fields, learned/prepared state, usage counters and activation currently need semantic Session Server operations rather than generic character mutation.

Those operations should reuse the same `validateRuntimeCustomSystemAccess()` boundary, then delegate rule enforcement to the existing custom-system ability/acquisition/activation helpers. Ability activation may also touch custom resources, HP, conditions or other character state, so its reverse snapshot should capture every affected domain while still producing one aggregate semantic log record.
