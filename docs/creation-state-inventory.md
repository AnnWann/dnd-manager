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

All Creation-owned editor mutations are now expected to target `draft`. The explicit Save action sends the complete draft and `baseRevision` to the canonical PATCH endpoint. Discard restores the draft from `base` without performing persistence.

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

`SessionRuntimeConfigSnapshot` carries the saved `creationRevision` with that projection. This establishes the versioned boundary the Session Server can cache; the database remains authoritative for `CreationState` and the Session Server must reject or ignore stale configuration revisions rather than becoming another owner of Creation data.

## Remaining migration work

The next integration should make the Session Server consume the versioned `SessionRuntimeConfigSnapshot` and refresh its cache when a newer Creation revision is saved. Once that is in place, authoritative gameplay validators can depend on the cached configuration revision without loading the full Creation document or its authoring-only domains.
