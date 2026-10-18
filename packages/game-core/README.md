# Game core

Framework-independent game rules, numeric calculations and pure state transitions shared by the website, Cloudflare Worker and prospective Owlbear Rodeo client.

## Extracted modules

- **Combat:** damage affinity normalization/resolution, weapon grip and damage dice, attack-rider damage choices and parsing.
- **Characters:** HP application, death saves, XP progression, attribute modifiers, proficiency progression and carrying capacity.
- **Inventory:** pocket eligibility, consumable quantities and stack merging.
- **Campaign:** progression settings and projection, long-rest supply settings, standard item volumes and mission-board selectors.
- **Dice:** bounded manual dice-expression parser.

Existing website imports remain available through compatibility adapters and re-exports. The package has no React, browser, database or Cloudflare runtime dependency. Session messages and wire contracts belong in `session-protocol`, not here.

## Deliberately application-owned

Functions which mutate `CharacterTemplate`, use formula evaluation, rely on persisted catalog data, inspect permissions or invoke session transport remain in their owning adapters. Extracting their arithmetic is separate from relocating their state management. The website or Durable Object must remain responsible for authorized state mutation.

## Remaining refactor risks

- More of the complex character rules (spellcasting, class progression, ability activation, equipment interactions and supply consumption) can be decomposed into pure domain functions, but are not yet completely isolated.
- The current automated suite covers representative behavior rather than every edge case of the above systems.
- Full compatibility must be confirmed by the branch CI website build, session-server typecheck and unit suite before merge.
