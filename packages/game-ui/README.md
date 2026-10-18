# Shared game UI

React presentation components that accept data, callbacks and optional host controls. These components must never read website contexts, routing, authentication, session transport, Prisma or Cloudflare state.

## Current extracted features

- Character sheet: `CharacterSheetLayout` (host-controlled play/config views), `CharacterHpPanel`, `StatShell`, `HitDiceRow`, `SpellcastingHandsNotice`, `CharacterSheetSection`, `CharacterSheetNumberField`, `CharacterSheetAttributeCard`, `CharacterSheetSaveCard`, `CharacterSheetSkillSearch` and `CharacterSheetSpellAttackTile`, plus `ExperienceProgress`, `HpValue`, `HpActionButtons`, `HpMaximumButton`, `HpSummaryGrid`
- Missions: `MissionBoard` (status columns and render-item callback), `MissionBoardToolbar` (counts and controlled search), `MissionCard` (mission details, objectives and host-supplied action buttons)
- Abilities and spells: `ActionGroup` for action discovery and usage badges, `ResourcePill` for spellcasting/resource counters, `SpellListBoard` for spell filtering and spell selection cards, `CharacterActionTabs` for action filters and `ActionRollFeedback` for rolled action results.
- Weapon controls: `WeaponAmmunitionBar` for current ammunition and spend callback, `AmmunitionSelectionList` for ammunition compatibility/selection, `HandGripPanel` for changing equipped grip/removal commands.
- Configuration: `CharacterConfigStatCell`, `CharacterConfigStatValue`, `CharacterConfigSaveToggle` for class-agnostic stat and saving throw editors.
- Initiative: `InitiativeRosterTable` (table headings and host-rendered rows), `InitiativeCardRail` (horizontal combat-card layout)
- Inventory: `InventoryTileGrid` (responsive slots and empty state)

## Integration contract

The website continues to own the hooks, session providers, editable dialogs, role checks, authoritative operation dispatch, inventory compartment rules and data normalization. The shared UI accepts plain props or callback render slots, preserving the current behavior and allowing an Owlbear-hosted application to supply its own adapters.

### Remaining work

- Extract complete initiative row/inspector and HP action dialogs without importing website-specific controls/models.
- Extract a reusable inventory container navigator, compartment operations UI, item editor and drag/drop layer with injected domain handlers.
- Extract mission edit dialogs with host-supplied draft creation and persistence, rather than importing the website's mission context.
- The high-level `CharacterSheetLayout` now accepts host-rendered play/configuration views; the inner feature tabs, roll controls, ability/spell panels and edit dialogs still need decoupling to become a complete reusable character sheet.
- Add interaction/component tests for the shared feature views (currently guarded by frontend build and CI dependency boundaries).

These are still outstanding; do not treat the current package as a complete standalone VTT user interface.
