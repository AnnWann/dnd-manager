# Objective 4 — Shared UI migration acceptance

## Migrated reusable React feature presentation
- Character sheet: play/configuration layout, core stats, attribute/save/skill controls, HP and hit dice, spell attack and hand restrictions.
- Weapon interactions: weapon and unarmed attack tiles, hand grips, swap dialog, ammunition selection/configuration and spending controls.
- Spell/ability interactions: spell list/filters, casting resource/upcast/target/damage choice fields, action groups and filtering, activation-level and manual damage/roll forms, resource counters and roll feedback.
- Custom-class configuration: class selection, class basics/caster settings, ASI level grid and saving-throw proficiency options.
- Missions: complete board, search toolbar, cards and editor dialog with injected host controls and ID factory.
- Inventory: tile grid, item tiles with menus, floating menus and transfer form.
- Initiative: table and rail, combatant inspector, HP mode tabs and full multipart damage/heal editor with host-calculated affinities.

## Architectural acceptance
- Shared `game-ui` imports neither website contexts, app routes, CharacterTemplate, nor session authority.
- The website retains persisted data, permission decisions, dice execution, spell and ability mutation workflows, inventory transfers, custom-class normalization and server messages. These are **application adapters**, not portable UI dependencies.
- Shared UI entrypoints are explicitly exported and the CI checks import boundaries, package export targets, Tailwind scanning, website build and Worker typecheck.
- Existing website pages use the extracted components through props, callbacks, injected controls and render slots.

## Exclusions from this milestone
Full independence of domain-specific configuration authoring panels, creature sheets and every per-feature modal is not established. Those host-owned editors have model-specific behavior and may be further decomposed when Owlbear needs them. This milestone means the common feature UI foundation can support alternative frontends—not that Owlbear integration has been implemented or that every application component has moved.

## Release gate
Do not mark this milestone validated until GitHub Actions passes on its latest branch commit. Live-environment testing remains deferred.
