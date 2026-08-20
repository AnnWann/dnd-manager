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

Runtime config visibility is participant-specific. MASTER receives every character configuration. A PLAYER receives their own characters plus characters marked `party`; other players' `private` characters and MASTER-only characters are removed from the config snapshot sent to that client.

The same visibility rule applies to live authoritative character state. Each WebSocket attachment stores the character ids visible to that participant for the active Creation revision. HP, conditions, abilities and character-lifecycle snapshots and incremental updates are filtered per recipient before they are written to the socket.

When a newer Creation revision is accepted, the server recalculates every connection's visible character set and immediately re-sends filtered HP, conditions, abilities and lifecycle snapshots.

Homebrew spell installation is validated against Creation. `character.spell.add` with `homebrew: true` is accepted only when its spell index exists in the active saved runtime config. Official spells are intentionally not subject to this lookup because official definitions are not owned by Creation.

## Custom-system runtime authority

Custom-system field and resource mutations are authoritative. The Session Server requires the referenced `systemId` to exist in the active runtime config, requires that exact system/version to be installed and enabled for the target character in Creation, and requires matching enabled live runtime state.

Custom-system ability live state is authoritative too. Semantic operations cover ability add/remove, custom field edits, learned/prepared state, usage counters and activation. Ability addition does not trust client-supplied acquisition or usage progress: the Session Server resolves the active ability type/preset from saved Creation definitions.

Custom ability activation executes the existing activation rules on the Session Server. It validates availability and usage, applies native/custom resource costs, condition changes and usage consumption, then projects the result into authoritative ability, HP and condition state. All touched state is committed under one semantic timeline record with one aggregate reverse snapshot.

Activation can reference resources belonging to another custom system. Every custom-system state changed by activation is therefore revalidated against saved Creation before commit.

Custom-system actions are runtime intent operations. The sheet sends only `{ characterId, systemId, actionId }`; the Session Server loads the saved action definition from runtime config and executes its configured effects itself.

`CustomAutomationRuntime` is a pure executor for saved custom automations. It evaluates automation conditions and applies configured resource/field effects through the existing custom-system permission boundary. A targeted `automation.execute` operation exists only for definitions whose event is `manual`.

## Automation event model

Custom-system events use a hybrid rule based on whether the application can actually observe the event from authoritative sheet state.

### Inferred events

When the event is explicit in an authoritative operation/state transition, the Session Server infers it and runs the corresponding automations inside the parent operation:

- custom ability activation → `abilityUsed`;
- `character.hp.damage` → `damageTaken`;
- `character.hp.heal` → `healingReceived`;
- short rest → `shortRestCompleted`;
- long rest → `longRestCompleted`;
- initiative start/end/advance → `combatStarted`, `combatEnded`, `roundStarted`, `roundEnded`, `turnStarted`, `turnEnded` as appropriate.

These automation effects do not create child timeline entries. They are committed with the parent operation and share its aggregate reverse. Initiative operations may affect multiple characters, so the initiative reverse also stores every touched authoritative ability snapshot.

### Explicit table-result events

Events that depend on information the application does not possess — especially dice/attack resolution at the physical table — are not inferred from unrelated state changes.

The existing `CustomAbilityActivationDefinition.trigger` / `triggerFieldId` is the declaration surface for those events. Activating the ability in the sheet is the player's explicit statement that the configured table event occurred.

Current mappings are:

- `onHit` → `attackHit`;
- `onCrit` → `attackHit` + `criticalHit`.

A critical hit deliberately fires both events because it is also a successful hit. The client does not send an arbitrary event name; the runtime resolves the event from the saved Creation definition for the activated ability. This prevents a modified client from freely claiming unrelated automation events.

Other trigger presets such as saves, misses or skill checks remain ordinary ability metadata until matching `CustomSystemEventType` events are introduced. They must not be guessed from state the application cannot observe.

## Logging and undo

Automation effects are part of the semantic operation that caused them:

- damage automation changes remain part of the damage log;
- rest automation changes remain part of the rest log;
- initiative automation changes remain part of the initiative log;
- ability-triggered `attackHit`/`criticalHit` automations remain part of the ability activation log.

MASTER therefore sees one meaningful event instead of one timeline row per internal automation effect, and undo restores all coupled authoritative state together.

Custom-system installation/enabling remains Creation configuration, not gameplay. A session operation cannot install a system or change its configured version/enabled flag.

## Remaining runtime work

The remaining custom-system runtime surfaces are standard-action overrides and native-stat overrides. Additional table-result automation events should follow the same rule as `attackHit`/`criticalHit`: if the result cannot be derived from authoritative application state, it must be declared through an explicit sheet interaction whose definition is validated from saved Creation configuration.
