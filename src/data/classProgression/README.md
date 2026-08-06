# Class progression data

This directory is the canonical source for class and subclass progression rules.
The former aggregate files in `src/models/leveling` now only re-export this data
for compatibility with older imports.

## Current structure

```text
classProgression/
├── applyClassProgressionModules.ts
├── builders.ts
├── fromCatalog.ts
├── index.ts
├── registry.ts
├── types.ts
├── catalog/
│   ├── ClassProgression.ts
│   └── XanatharSubclasses.ts
└── classes/
    ├── artificer/
    ├── barbarian/
    ├── bard/
    ├── cleric/
    ├── druid/
    ├── fighter/
    ├── monk/
    ├── paladin/
    ├── ranger/
    ├── rogue/
    ├── sorcerer/
    ├── warlock/
    └── wizard/
```

`catalog/` contains the progression definitions migrated from the old model,
including their stable feature IDs. `fromCatalog.ts` converts each class into an
authoritative `ClassProgressionModule`, and `registry.ts` registers all thirteen
classes.

`ExpandedClassProgression.ts` consumes this registry directly. It no longer
merges a separate Xanathar fallback from `models/leveling`.

## Compatibility

These files remain as thin compatibility exports:

- `src/models/leveling/ClassProgression.ts`
- `src/models/leveling/XanatharSubclasses.ts`

They contain no progression data. Existing imports continue to work while new
code should import from `src/data/classProgression`.

## Adding or replacing class data

A class module may replace or extend catalog data:

```ts
import { defineClassProgression, defineFeature } from "../../builders"
import { warlockSubclasses } from "./subclasses"

export const warlockProgression = defineClassProgression({
  className: "warlock",
  featureMergeMode: "replace",
  features: [
    defineFeature({
      id: "pact-magic-1",
      name: "Pact Magic",
      level: 1,
      source: "PHB",
    }),
  ],
  subclasses: warlockSubclasses,
})
```

Use explicit feature IDs whenever possible. Persisted abilities refer to these
IDs, so changing an existing ID is a data migration rather than a translation.

## Adding or replacing subclass data

A concrete subclass can live in a nested module such as
`classes/warlock/subclasses/hexblade/index.ts`:

```ts
import { defineSubclass, defineFeature } from "../../../../builders"

export const hexblade = defineSubclass({
  id: "hexblade",
  name: "The Hexblade",
  className: "warlock",
  source: "Xanathar",
  mergeMode: "replace",
  features: [
    defineFeature({
      id: "hexblades-curse-1",
      name: "Hexblade's Curse",
      level: 1,
      source: "Xanathar",
    }),
  ],
})
```

Then import it from the class-level `subclasses/index.ts` and replace the
catalog-derived class module when that class is migrated to fully explicit
files.

## Complete Ability configuration

A feature may carry an optional `ability` object. It accepts every behavioral
and content field from `Ability`. The progression feature owns the stable ID,
while `originalAbilityId` and acquisition metadata remain runtime-generated.

```ts
import { defineProgressionAbility } from "../../models/leveling/ProgressionAbilityConfig"

const ability = defineProgressionAbility({
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
})
```

Explicit ability configuration is applied after inferred mechanics and is
therefore authoritative.

## Merge behavior

- Omitted sections keep the current catalog data.
- `extend` replaces matching IDs and keeps unmatched definitions.
- `replace` makes the module authoritative for that class or subclass section.

The migrated class modules currently use `replace` for definitions, features,
and subclasses, so the application is fed entirely from the new data layer.
