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

## Migration consequence

The next phase should not try to replace every existing endpoint at once. It should add the canonical revisioned Creation snapshot API and make the editor consume that snapshot. Once reads and draft semantics are stable, the old independent write paths can be removed domain by domain.
