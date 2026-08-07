# Class progression data

This directory is the canonical runtime source for class and subclass
progression. Consumers must import from `src/data/classProgression`, never from
legacy files under `src/models/leveling`.

## Folder convention

```text
classProgression/
├── ability.ts
├── builders.ts
├── index.ts
├── migration.ts
├── registry.ts
├── types.ts
└── classes/
    └── warlock/
        ├── index.ts
        └── subclasses/
            ├── index.ts
            └── hexblade/
                └── index.ts
```

Each class owns its metadata, level features, cantrip progression and subclass
collection. Each concrete subclass owns its features in its nested folder.

## Adding a complete feature

Use `feature()` for progression metadata and `ability` for behavior. The class
file is the only source that needs to be edited.

```ts
import {
  defineProgressionAbility,
  feature,
  grantProgressionSpell,
  progressionUsage,
} from "../../builders"

const example = feature(3, "Arcane Reserve", "PHB", {
  description:
    "You draw on a limited reserve of arcane power to produce this effect.",
  ability: defineProgressionAbility({
    kind: "active",
    category: "general",
    actionKind: "bonusAction",
    effectDuration: "instant",
    trigger: "onSpellCast",
    usage: progressionUsage(1, "longRest", {
      maxFormula: "max(1, character.attributeModifier.cha)",
    }),
    grantedSpells: [
      grantProgressionSpell("misty-step", {
        castingMode: "source",
        attribute: "cha",
      }),
    ],
    grantedProficiencies: [],
    bonuses: {},
  }),
})
```

`description` is the canonical displayed rules text. Put behavior in `ability`;
do not duplicate the description unless the runtime ability intentionally needs
different wording.

## State is not declared in class files

Progression configuration deliberately excludes runtime-owned fields such as:

- ability IDs and acquisition metadata;
- consumed uses and remaining cooldown;
- active/inactive benefit state;
- equipment provenance.

Therefore `progressionUsage()` does not accept `used` or
`cooldownRemaining`. New abilities start with zero consumed uses, while refresh
and migration preserve the character's current state.

## Formula variables

`usage.maxFormula` and bonus `formula` fields use character-sheet variables,
including:

```text
character.level
character.proficiencyBonus
character.attributeModifier.cha
character.class.warlock.level
character.skill.perception
character.hp.maximum
```

The formula engine supports arithmetic, comparisons, boolean operators and
`min`, `max`, `round`, `floor`, `ceil`, `abs`, `clamp` and `if`.
Always provide a numeric fallback (`max` or `value`) alongside a formula.

## Spell grants

Use `grantProgressionSpell()`:

- `castingMode: "source"` uses the ability's own usage counter;
- `castingMode: "known"` adds the spell as a known spell;
- set `attribute` explicitly instead of relying on the Charisma fallback.

Runtime acquisition metadata is attached automatically.

## Legacy mechanics fallback

A feature with an `ability` configuration bypasses
`ProgressionFeatureMechanics.ts` and
`ProgressionFeatureMechanicsAdditional.ts`. Unconfigured features continue to
use those maps, which permits incremental migration.

After fully configuring a feature in its class/subclass module, remove its old
hardcoded branch from the fallback files.

## Updating existing characters

`CLASS_PROGRESSION_DATA_VERSION` in `migration.ts` controls automatic refresh
when a character is hydrated. Increment it whenever canonical descriptions or
mechanics change and existing characters need to be synchronized.

The refresh updates source-controlled content and mechanics while preserving:

- IDs and acquisition history;
- used charges and cooldown remaining;
- active effects;
- choice-projected names and descriptions.

## Stable feature IDs

`feature()` derives an ID from the original name and level. Pass an explicit
`id` only when the generated value must be overridden. Persisted abilities refer
to these IDs, so changing one requires a dedicated data migration.
