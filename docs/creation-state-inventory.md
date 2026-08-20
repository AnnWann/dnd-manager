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

The same visibility rule applies to live authoritative character state. Each WebSocket attachment stores the character ids visible to that participant for the active Creation revision. HP, conditions, abilities and character-lifecycle snapshots and incremental updates are filtered per recipient before they are written to the socket. Domain actors use a visibility-filtered Durable Object context for outbound broadcasts, so equipment, magic, proficiency, race and profile operations cannot bypass the same boundary when they emit character state.

When a newer Creation revision is accepted, the server recalculates every connection's visible character set and immediately re-sends filtered HP, conditions, abilities and lifecycle snapshots. This is important when a character changes from `party` to `private` or `master`, or is removed from Creation: clients replace their local authoritative maps with the newly filtered snapshots instead of retaining stale character data until reconnect.

Homebrew spell installation is validated against Creation. `character.spell.add` with `homebrew: true` is accepted only when its spell index exists in the active saved runtime config. Official spells are intentionally not subject to this lookup because official definitions are not owned by Creation.

## Custom-system runtime authority

Custom-system field and resource mutations are authoritative. The session workspace derives semantic operations from local UI changes instead of persisting whole-character mutations. The Session Server requires the referenced `systemId` to exist in the active runtime config, requires that exact system/version to be installed and enabled for the target character in Creation, and requires matching enabled live runtime state. It then delegates field/resource validation to the existing `CustomSystemState` rules, including edit permissions, required fields, value constraints, resource min/max rules and manual-adjustment permissions. Accepted mutations produce one semantic log record, an undo snapshot and a visibility-filtered authoritative character update.

Custom-system ability live state is authoritative too. Semantic operations cover ability add/remove, custom field edits, learned/prepared state, usage counters and activation. Ability addition does not trust client-supplied acquisition or usage progress: the Session Server resolves the active ability type/preset from saved Creation definitions, initializes learned/prepared state from those rules and resets limited usage from the active definition.

Custom ability activation executes the existing activation rules on the Session Server. It validates availability and usage, applies native/custom resource costs, condition changes and usage consumption, then projects the result into authoritative ability, HP and condition state. All touched state is committed together under one semantic timeline record with one aggregate `character.ability.restore` reverse snapshot, so MASTER undo restores the coupled state instead of producing separate subevents.

Activation can reference resources belonging to another custom system. Every custom-system state changed by activation is therefore revalidated against saved Creation before commit: the target system must exist, be installed and enabled for the character, and its live state version must match the configured installation version. Activation is not allowed to install or remove custom systems as a side effect.

Custom-system actions are also runtime intent operations. The sheet sends only `{ characterId, systemId, actionId }`; the Session Server loads the saved action definition from runtime config and executes `resourceChanges` and `conditionChanges` itself. Actions use the same aggregate ability/HP/conditions commit and reverse strategy as custom abilities. The client no longer sends precomputed action effects while connected to the authoritative session runtime.

`CustomAutomationRuntime` is a pure executor for saved custom automations. It evaluates automation conditions using literals, fields, resources, character formula paths and formulas, then applies `modifyResource`, `setField` and `modifyField` effects through the existing automation permission boundary. A targeted `automation.execute` operation exists only for definitions whose event is `manual`.

Automatic custom-system hooks currently execute inside their parent authoritative operation rather than creating child timeline events:

- custom ability activation triggers `abilityUsed` automations;
- `character.hp.damage` triggers `damageTaken` automations;
- `character.hp.heal` triggers `healingReceived` automations;
- short rest triggers `shortRestCompleted` automations;
- long rest triggers `longRestCompleted` automations.

When one of those automations changes custom-system state, that state is committed together with the parent operation. HP damage/healing upgrades its reverse to an aggregate ability/HP/conditions snapshot when needed; rests already use their aggregate rest reverse. Therefore MASTER sees one semantic log entry for the action that happened, not one entry per internal automation effect.

Custom-system installation/enabling remains Creation configuration, not gameplay. A session operation cannot install a system or change its configured version/enabled flag.

The runtime-config wire parser validates revision shape, character configuration, spell identifiers, custom-system identifiers and duplicate ids before the Durable Object accepts a publish.

## Remaining runtime work

Initiative-derived automation events remain to be connected: `combatStarted`, `combatEnded`, `roundStarted`, `roundEnded`, `turnStarted` and `turnEnded`. Those events may affect multiple character entries in one initiative operation, so their implementation must extend the initiative reverse to include every affected character snapshot and restore them atomically with initiative state. They should not be implemented as independent child log records.

`attackHit` and `criticalHit` remain intentionally unhooked until there is an authoritative attack-resolution operation that can produce those events reliably. Client-side inference would not be authoritative.

After event wiring, the remaining custom-system runtime surfaces are standard-action overrides and native-stat overrides.
