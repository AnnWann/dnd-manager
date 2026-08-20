# Creation state inventory

This document records the current data flow behind the MASTER `creation/*` routes before the Creation editor is migrated to a single snapshot/draft/PATCH model.

## Scope boundary

`CreationState` is the persistent campaign configuration authored from Creation. It is not synonymous with every screen rendered under `/session/:campaignId/creation/*`.

The following remain outside the draftable Creation document:

- campaign membership and role administration;
- pending approval/request workflow;
- audit metadata (`createdAt`, `updatedAt`, `createdBy`, etc.);
- transient UI state;
- live gameplay state such as HP, resources, inventories, conditions, initiative and missions.

## Current route inventory

| Route | Current read source | Current write path | CreationState? | Runtime relevant? |
| --- | --- | --- | --- | --- |
| `creation/settings` | `getSessionCreationSettings()` plus `CharacterContext` | `updateSessionMember()` and `updateCharacter()` | Character configuration only. Membership is administrative and excluded. | Character owner/type/visibility/uniqueness/custom-system assignments are relevant to authorization/validation. Hidden tabs are editor/display configuration only. |
| `creation/requests` | session request APIs | request review APIs | No. This is workflow state, not configuration authoring. | No direct runtime projection. Approved content may later appear in CreationState through its canonical content domain. |
| `creation/homebrew` | `getSessionHomebrew()`, `MagicContext`, `CustomSystemsContext` | approval APIs plus provider persistence | Approved/installed content contributes to spells/custom systems. Review records themselves are excluded. | Spells and custom-system definitions can be required for authoritative validation. |
| `creation/items-compendium` | `getSessionItemCompendium()` | per-entry upsert/delete HTTP calls | Yes. | No. The compendium is an authoring library; instantiated live inventory belongs to session state. |
| `creation/creatures-compendium` | `CreatureCompendiumProvider` / local repository | provider saves local repository state | Yes, but it is not campaign-persistent yet. | No. The compendium is an authoring library; spawned creatures become live session state. |
| `creation/custom-systems` | `CustomSystemsProvider` | `/api/custom-systems` auto-save with its own revision/merge logic | Yes. | Yes. Definitions are needed to understand custom character resources/abilities. |
| `creation/magic` | `MagicContext`, `getSessionHomebrew()` and user spell library APIs | `MagicContext`/`AppStateV1` plus spell submission APIs | Saved/approved campaign spell definitions belong in CreationState. User-library ownership/submission workflow does not. | Yes. Spell definitions may be needed to validate live spell/resource operations. |

## Existing persistence split

Creation is currently fragmented across several stores:

### Relational HTTP state

- campaign settings/members;
- campaign homebrew links and approvals;
- session item compendium;
- user-owned homebrew spell submission/review data;
- session character records loaded through campaign session APIs.

### `AppStateV1`

The legacy synchronized application state still contains data used by Creation, notably:

- full character snapshots;
- saved spell definitions.

This is problematic for the new boundary because full character snapshots also contain live gameplay state. `CreationState` therefore stores only the character configuration fields currently edited from `CharacterSettingsModal` rather than embedding `CharacterTemplateProps`.

### Provider/local persistence

- `CustomSystemsProvider` maintains its own local draft/revision/auto-save workflow through `/api/custom-systems`;
- `CreatureCompendiumProvider` currently persists through a local creature repository;
- local-development item compendium fallback uses campaign-scoped local storage.

These stores are inventory findings, not the desired final architecture. Later phases will load them into the canonical Creation snapshot and remove their independent Creation write paths.

## Canonical domain introduced by this phase

`src/shared/creation/creation.types.ts` defines:

- `CreationState`;
- `CreationCharacterConfiguration`;
- `CreationItemCompendiumEntry`;
- `CreationSnapshot`.

The initial state contains the authoring domains that need to converge behind the future single GET/PATCH contract:

- character configuration;
- campaign spell definitions;
- item compendium entries;
- creature compendium entries;
- custom-system definitions.

It deliberately does not contain membership, requests, editor state, or gameplay state.

## Runtime projection

`src/shared/session-runtime/sessionRuntimeConfig.ts` defines `SessionRuntimeConfig` and `toSessionRuntimeConfig()`.

The runtime projection currently contains only:

- reduced character configuration needed for ownership/type/visibility/uniqueness/custom-system validation;
- spell definitions;
- custom-system definitions.

It deliberately excludes:

- hidden character tabs;
- item compendium;
- creature compendium;
- request/review records;
- membership administration data;
- all live gameplay state.

The Session Server will eventually cache this projection with a Creation revision. The database remains authoritative for `CreationState`; the Session Server does not become a second owner of Creation configuration.

## Revisioned editor migration status

The Creation route now owns one `CreationEditorProvider` for the entire `creation/*` subtree. It loads the canonical snapshot once and keeps separate `base` and `draft` copies plus `baseRevision`.

The first migrated draft domains are:

- character configuration from `creation/settings`;
- the session item compendium from `creation/items-compendium`.

Editing those domains performs no persistence request. Membership and role administration remains immediate because it is explicitly outside `CreationState`.

The editor exposes explicit Save and Discard controls. Save sends one PATCH containing the draft and its `baseRevision`. The server rejects stale saves with `409 CREATION_REVISION_CONFLICT`.

The PATCH transaction currently persists only the domains whose editor write paths have actually migrated: character configuration and item compendium. Character persistence merges the Creation-owned fields into the latest stored character JSON so live HP, resources, inventory and other gameplay state are not replaced by a stale editor snapshot. The campaign revision increments only when the transaction succeeds.

The remaining Creation-owned domains continue to use their legacy stores until their editor routes are migrated:

- creature compendium;
- custom-system definitions;
- campaign spell definitions.

Those domains are intentionally not rewritten by the current PATCH, preventing an old Creation draft from overwriting changes still made through their legacy providers.

## Migration consequence

Continue moving the remaining Creation-owned domains behind `CreationEditorProvider` one at a time. Only after a domain mutates the shared draft should the atomic PATCH become responsible for persisting that domain. Once all Creation-owned domains have moved, the old independent write paths can be removed entirely and the saved `CreationState` revision can be projected to the Session Server.
