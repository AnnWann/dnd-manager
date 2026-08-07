# Manual class progression

This directory intentionally contains **no bundled class features, subclass
catalog, option lists or subclass spell grants**.

The application keeps only minimal class metadata needed by the character sheet
(class identifier, display label and hit die). Character creation and level-up
are data-entry workflows: the player uses their own rules reference and enters
the subclass and every gained ability manually.

## What the application does not infer

- when a subclass is gained;
- which subclasses exist;
- which class or subclass features are gained at a level;
- feature descriptions;
- invocations, maneuvers, fighting styles, metamagic or similar choice lists;
- automatic subclass spell grants;
- class spell-selection limits inside progression;
- multiclass prerequisites or class proficiency packages.

## Adding a class feature

During character creation or level-up, use **Adicionar característica**. The
normal ability editor supports descriptions, actions, usage counters, formulas,
bonuses, granted spells, granted proficiencies and other generic ability fields.
The entered data belongs to the user's character; it is not copied from a
bundled rules catalog.

## Subclasses

Subclass name and optional source/reference are free-text fields. The app stores
what the user enters and does not validate the name against a catalog.

## Existing characters

Existing abilities and subclass selections remain character-owned data. Removing
the bundled catalog does not delete them. New progression events simply stop
generating rules content automatically.
