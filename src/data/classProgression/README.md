# Class progression data

This directory is the canonical source for class and subclass progression rules.
Consumers must import progression definitions and lookup functions from
`src/data/classProgression`, not from `src/models/leveling`.

## Folder convention

```text
classProgression/
├── builders.ts
├── index.ts
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

Each class owns its metadata, level features, cantrip progression, and the
subclass collection exported by its `subclasses/index.ts`.

Each concrete subclass owns its features in a nested folder. The class-level
subclass index only imports and collects those modules.

## Adding a class

Define the complete class progression in its class module:

```ts
import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { warlockSubclasses } from "./subclasses"

export const warlockProgression = defineClassProgression({
  className: "warlock",
  label: "Warlock",
  hitDie: "d8",
  source: "PHB",
  subclassLevel: 1,
  cantripsKnown: { 1: 2, 4: 3, 10: 4 },
  features: withAbilityScoreImprovements("warlock", [
    feature(1, "Otherworldly Patron"),
    feature(1, "Pact Magic"),
  ]),
  subclasses: warlockSubclasses,
})
```

Then register the module in `registry.ts`.

## Adding a subclass

Create a nested module such as
`classes/warlock/subclasses/hexblade/index.ts`:

```ts
import { defineSubclass, feature } from "../../../../builders"

export const hexblade = defineSubclass({
  id: "hexblade",
  name: "The Hexblade",
  className: "warlock",
  source: "Xanathar",
  features: [
    feature(1, "Hexblade's Curse", "Xanathar"),
    feature(1, "Hex Warrior", "Xanathar"),
  ],
})
```

Then import it from `classes/warlock/subclasses/index.ts`.

## Stable feature IDs

`feature()` derives the existing stable ID from the original feature name and
level. Pass an explicit `id` in the extra configuration only when the generated
ID must be overridden. Persisted abilities refer to these IDs, so changing one
requires a data migration.

## Complete ability configuration

A feature may provide an `ability` configuration. The progression feature owns
the stable feature ID, while runtime acquisition metadata and consumed-use
state remain character-owned.

```ts
import { feature } from "../../builders"
import { defineProgressionAbility } from "../../../models/leveling/ProgressionAbilityConfig"

const configuredFeature = feature(3, "Example Feature", "PHB", {
  ability: defineProgressionAbility({
    kind: "active",
    category: "general",
    actionKind: "bonusAction",
    effectDuration: "lasting",
    effectDurationText: "For 1 minute.",
    effectPersistence: "untilEnd",
    trigger: "onHit",
    usage: {
      max: 1,
      maxFormula: "character.proficiencyBonus",
      used: 0,
      reset: "longRest",
    },
    grantedSpells: [],
    grantedProficiencies: [],
    bonuses: {},
    benefitsActive: false,
  }),
})
```

There is no aggregate catalog or legacy fallback. The class and subclass files
under `classes/` are the runtime source used by character creation, level-up,
spell selection, and feature materialization.
