import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { ClassName } from "../sheet/Class"

export type DynamicSubclassSpellMode =
  | "expanded-list"
  | "always-prepared"
  | "bonus-known"

export type DynamicSubclassSpellGrant = {
  className: ClassName
  subclassId: string
  classLevel: number
  spellName: string
  mode: DynamicSubclassSpellMode
  sourceName: string
}

type Tier = [classLevel: number, ...spellNames: string[]]

const LAND_SPELLS: Record<string, Tier[]> = {
  arctic: [
    [3, "Hold Person", "Spike Growth"],
    [5, "Sleet Storm", "Slow"],
    [7, "Freedom of Movement", "Ice Storm"],
    [9, "Commune with Nature", "Cone of Cold"],
  ],
  coast: [
    [3, "Mirror Image", "Misty Step"],
    [5, "Water Breathing", "Water Walk"],
    [7, "Control Water", "Freedom of Movement"],
    [9, "Conjure Elemental", "Scrying"],
  ],
  desert: [
    [3, "Blur", "Silence"],
    [5, "Create Food and Water", "Protection from Energy"],
    [7, "Blight", "Hallucinatory Terrain"],
    [9, "Insect Plague", "Wall of Stone"],
  ],
  forest: [
    [3, "Barkskin", "Spider Climb"],
    [5, "Call Lightning", "Plant Growth"],
    [7, "Divination", "Freedom of Movement"],
    [9, "Commune with Nature", "Tree Stride"],
  ],
  grassland: [
    [3, "Invisibility", "Pass without Trace"],
    [5, "Daylight", "Haste"],
    [7, "Divination", "Freedom of Movement"],
    [9, "Dream", "Insect Plague"],
  ],
  mountain: [
    [3, "Spider Climb", "Spike Growth"],
    [5, "Lightning Bolt", "Meld into Stone"],
    [7, "Stone Shape", "Stoneskin"],
    [9, "Passwall", "Wall of Stone"],
  ],
  swamp: [
    [3, "Darkness", "Melf's Acid Arrow"],
    [5, "Water Walk", "Stinking Cloud"],
    [7, "Freedom of Movement", "Locate Creature"],
    [9, "Insect Plague", "Scrying"],
  ],
  underdark: [
    [3, "Spider Climb", "Web"],
    [5, "Gaseous Form", "Stinking Cloud"],
    [7, "Greater Invisibility", "Stone Shape"],
    [9, "Cloudkill", "Insect Plague"],
  ],
}

const GENIE_SPELLS: Record<string, Tier[]> = {
  dao: [
    [1, "Sanctuary"],
    [3, "Spike Growth"],
    [5, "Meld into Stone"],
    [7, "Stone Shape"],
    [9, "Wall of Stone"],
  ],
  djinni: [
    [1, "Thunderwave"],
    [3, "Gust of Wind"],
    [5, "Wind Wall"],
    [7, "Greater Invisibility"],
    [9, "Seeming"],
  ],
  efreeti: [
    [1, "Burning Hands"],
    [3, "Scorching Ray"],
    [5, "Fireball"],
    [7, "Fire Shield"],
    [9, "Flame Strike"],
  ],
  marid: [
    [1, "Fog Cloud"],
    [3, "Blur"],
    [5, "Sleet Storm"],
    [7, "Control Water"],
    [9, "Cone of Cold"],
  ],
}

const CHOICE_ALIASES: Record<string, string> = {
  arctico: "arctic",
  artico: "arctic",
  costa: "coast",
  deserto: "desert",
  floresta: "forest",
  pradaria: "grassland",
  montanha: "mountain",
  pantano: "swamp",
  umbreterna: "underdark",
  bem: "good",
  mal: "evil",
  ordem: "law",
  caos: "chaos",
  neutralidade: "neutrality",
}

const DIVINE_SOUL_AFFINITY_SPELL: Record<string, string> = {
  good: "Cure Wounds",
  evil: "Inflict Wounds",
  law: "Bless",
  chaos: "Bane",
  neutrality: "Protection from Evil and Good",
  neutral: "Protection from Evil and Good",
}

export function getDynamicSubclassSpellGrants(
  character: CharacterTemplate,
  className: ClassName,
  subclassId: string | undefined,
  classLevel: number,
): DynamicSubclassSpellGrant[] {
  if (!subclassId) return []

  const classEntry = character
    .get("sheet")
    .classes?.find((entry) => entry.className === className)
  const choices = classEntry?.levelChoices ?? {}
  const sourceName = classEntry?.subclass?.name ?? subclassId

  if (className === "druid" && subclassId === "land") {
    const landType = resolveChoice(choices["circle-land-type"]?.[0])
    return tierGrants(
      className,
      subclassId,
      classLevel,
      LAND_SPELLS[landType] ?? [],
      "always-prepared",
      sourceName,
    )
  }

  if (className === "warlock" && subclassId === "genie") {
    const genieKind = resolveChoice(choices["genie-kind"]?.[0])
    return tierGrants(
      className,
      subclassId,
      classLevel,
      GENIE_SPELLS[genieKind] ?? [],
      "expanded-list",
      sourceName,
    )
  }

  if (className === "sorcerer" && subclassId === "divine-soul") {
    const affinity = resolveChoice(
      choices["divine-soul-affinity"]?.[0],
    )
    const spellName = DIVINE_SOUL_AFFINITY_SPELL[affinity]
    return spellName
      ? [
          {
            className,
            subclassId,
            classLevel: 1,
            spellName,
            mode: "bonus-known",
            sourceName,
          },
        ]
      : []
  }

  return []
}

function tierGrants(
  className: ClassName,
  subclassId: string,
  classLevel: number,
  tiers: Tier[],
  mode: DynamicSubclassSpellMode,
  sourceName: string,
): DynamicSubclassSpellGrant[] {
  return tiers
    .filter(([requiredLevel]) => requiredLevel <= classLevel)
    .flatMap(([requiredLevel, ...spellNames]) =>
      spellNames.map((spellName) => ({
        className,
        subclassId,
        classLevel: requiredLevel,
        spellName,
        mode,
        sourceName,
      })),
    )
}

function resolveChoice(value: string | undefined): string {
  const normalized = normalizeChoice(value)
  return CHOICE_ALIASES[normalized] ?? normalized
}

function normalizeChoice(value: string | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
