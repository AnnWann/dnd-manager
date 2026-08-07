# Manual class progression

This directory intentionally contains **no bundled class features, subclass
catalog, option lists or subclass spell grants**.

The application keeps structural class metadata needed by the character sheet
and creator: class identifier, display label, hit die and public spell-count
progression. Character creation and level-up otherwise remain data-entry
workflows: the player uses their own rules reference and enters the subclass and
every gained ability manually.

## Structural progression that remains

The application may encode numerical progression that is useful across the
sheet and creator, including:

- hit die;
- spellcasting progression;
- number of cantrips known;
- number of spells known, spellbook entries or prepared spells;
- maximum spell level available at a class level.

These rules contain counts and formulas only. They do not contain spell names,
feature text, subclass content or choice catalogs.

## What the application does not infer

- when a subclass is gained;
- which subclasses exist;
- which class or subclass features are gained at a level;
- feature descriptions;
- invocations, maneuvers, fighting styles, metamagic or similar choice lists;
- automatic subclass spell grants;
- which spells are legal for a class or subclass;
- multiclass prerequisites or class proficiency packages.

## Adding a class feature

During character creation or level-up, use **Adicionar característica**. The
normal ability editor supports descriptions, actions and basic usage directly;
formulas, bonuses, granted spells, granted proficiencies and other mechanical
configuration live under **Opções avançadas**.

The entered data belongs to the user's character; it is not copied from a
bundled rules catalog.

## Proficiencies

Class proficiencies are entered manually during character creation using the
generic proficiency editor. This supports skills, saving throws, weapons,
armor, shields, tools, languages, vehicles and other proficiency categories.

## Spells

Caster classes expose the loaded spell compendium during creation. The creator
uses the structural progression above to limit spell level and selection count,
but it deliberately does not decide whether a spell belongs to that class. The
player consults their own reference for the legal list.

## Subclasses

Subclass name and optional source/reference are free-text fields. The app stores
what the user enters and does not validate the name against a catalog.

## Existing characters

Existing abilities and subclass selections remain character-owned data. Removing
the bundled catalog does not delete them. New progression events simply stop
generating rules content automatically.
