from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# Shared typed damage model.
# ---------------------------------------------------------------------------
write("src/models/combat/Damage.ts", r'''export const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const

export type DamageType = (typeof DAMAGE_TYPES)[number]
export type DamageAffinityKind = "immunity" | "resistance" | "vulnerability"
export type DamageAffinityQualifier = "any" | "magical" | "nonmagical"

export type DamageAffinity = {
  damageType: DamageType
  kind: DamageAffinityKind
  /** Restricts a rule such as resistance to nonmagical physical damage. */
  qualifier?: DamageAffinityQualifier
  label?: string
}

export type DamageContext = {
  magical?: boolean
}

export type DamageResolution = {
  requested: number
  applied: number
  damageType?: DamageType
  affinity?: DamageAffinityKind
  matchedRules: DamageAffinity[]
}

export const DAMAGE_TYPE_OPTIONS: Array<{ value: DamageType; label: string }> = [
  { value: "acid", label: "Ácido" },
  { value: "bludgeoning", label: "Concussão" },
  { value: "cold", label: "Frio" },
  { value: "fire", label: "Fogo" },
  { value: "force", label: "Força" },
  { value: "lightning", label: "Elétrico" },
  { value: "necrotic", label: "Necrótico" },
  { value: "piercing", label: "Perfurante" },
  { value: "poison", label: "Veneno" },
  { value: "psychic", label: "Psíquico" },
  { value: "radiant", label: "Radiante" },
  { value: "slashing", label: "Cortante" },
  { value: "thunder", label: "Trovão" },
]

export function damageTypeLabel(type: DamageType | undefined): string {
  return DAMAGE_TYPE_OPTIONS.find((entry) => entry.value === type)?.label ?? "Sem tipo"
}

export function damageAffinityLabel(kind: DamageAffinityKind): string {
  if (kind === "immunity") return "Imunidade"
  if (kind === "resistance") return "Resistência"
  return "Vulnerabilidade"
}

export function normalizeDamageAffinities(value: unknown): DamageAffinity[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const record = entry as Record<string, unknown>
    const damageType = normalizeDamageType(record.damageType ?? record.type)
    const kind = normalizeDamageAffinityKind(record.kind ?? record.affinity)
    if (!damageType || !kind) return []
    const qualifier = normalizeQualifier(record.qualifier)
    const key = `${damageType}:${kind}:${qualifier}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{
      damageType,
      kind,
      qualifier,
      label: typeof record.label === "string" && record.label.trim()
        ? record.label.trim()
        : undefined,
    }]
  })
}

export function resolveDamage(
  amount: number,
  damageType: DamageType | undefined,
  affinities: DamageAffinity[] | undefined,
  context: DamageContext = {},
): DamageResolution {
  const requested = Math.max(0, Math.trunc(amount))
  if (!damageType || requested <= 0) {
    return { requested, applied: requested, damageType, matchedRules: [] }
  }

  const matchedRules = normalizeDamageAffinities(affinities).filter(
    (rule) => rule.damageType === damageType && qualifierMatches(rule.qualifier, context),
  )
  if (matchedRules.some((rule) => rule.kind === "immunity")) {
    return { requested, applied: 0, damageType, affinity: "immunity", matchedRules }
  }

  const resistant = matchedRules.some((rule) => rule.kind === "resistance")
  const vulnerable = matchedRules.some((rule) => rule.kind === "vulnerability")
  if (resistant && vulnerable) {
    return { requested, applied: requested, damageType, matchedRules }
  }
  if (resistant) {
    return {
      requested,
      applied: Math.floor(requested / 2),
      damageType,
      affinity: "resistance",
      matchedRules,
    }
  }
  if (vulnerable) {
    return {
      requested,
      applied: requested * 2,
      damageType,
      affinity: "vulnerability",
      matchedRules,
    }
  }
  return { requested, applied: requested, damageType, matchedRules }
}

/** Best-effort migration for old free-text compendium fields. */
export function inferDamageAffinitiesFromLegacy(
  vulnerabilities: string | undefined,
  resistances: string | undefined,
  immunities: string | undefined,
): DamageAffinity[] {
  return normalizeDamageAffinities([
    ...parseLegacyList(vulnerabilities, "vulnerability"),
    ...parseLegacyList(resistances, "resistance"),
    ...parseLegacyList(immunities, "immunity"),
  ])
}

function parseLegacyList(text: string | undefined, kind: DamageAffinityKind): DamageAffinity[] {
  if (!text?.trim()) return []
  const normalized = normalizeText(text)
  const qualifier: DamageAffinityQualifier =
    /nao mag|não mag|nonmag/.test(normalized) ? "nonmagical" :
    /magico|mágico|magical/.test(normalized) ? "magical" :
    "any"
  return DAMAGE_TYPES.flatMap((damageType) =>
    legacyNames(damageType).some((name) => normalized.includes(name))
      ? [{ damageType, kind, qualifier }]
      : [],
  )
}

function legacyNames(type: DamageType): string[] {
  const map: Record<DamageType, string[]> = {
    acid: ["acid", "acido"],
    bludgeoning: ["bludgeoning", "concussao", "contundente"],
    cold: ["cold", "frio", "gelido"],
    fire: ["fire", "fogo"],
    force: ["force", "forca"],
    lightning: ["lightning", "eletrico", "eletricidade", "relampago"],
    necrotic: ["necrotic", "necrotico"],
    piercing: ["piercing", "perfurante"],
    poison: ["poison", "veneno"],
    psychic: ["psychic", "psiquico"],
    radiant: ["radiant", "radiante"],
    slashing: ["slashing", "cortante"],
    thunder: ["thunder", "trovao", "sonoro"],
  }
  return map[type]
}

function normalizeDamageType(value: unknown): DamageType | undefined {
  return DAMAGE_TYPES.includes(value as DamageType) ? value as DamageType : undefined
}
function normalizeDamageAffinityKind(value: unknown): DamageAffinityKind | undefined {
  return value === "immunity" || value === "resistance" || value === "vulnerability"
    ? value
    : undefined
}
function normalizeQualifier(value: unknown): DamageAffinityQualifier {
  return value === "magical" || value === "nonmagical" ? value : "any"
}
function qualifierMatches(qualifier: DamageAffinityQualifier | undefined, context: DamageContext): boolean {
  if (!qualifier || qualifier === "any") return true
  if (qualifier === "magical") return context.magical === true
  return context.magical !== true
}
function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
}
''')

# ---------------------------------------------------------------------------
# Shared editor, used by both character and creature configuration.
# ---------------------------------------------------------------------------
write("src/features/combat/DamageAffinityEditor.tsx", r'''import { Plus, Trash2 } from "lucide-react"

import { Button } from "../../components/ui/Button"
import {
  DAMAGE_TYPE_OPTIONS,
  damageAffinityLabel,
  type DamageAffinity,
  type DamageAffinityKind,
  type DamageAffinityQualifier,
  type DamageType,
} from "../../models/combat/Damage"

const selectClassName =
  "h-9 min-w-0 rounded-lg border border-border bg-bg px-2 text-xs text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"

export function DamageAffinityEditor({
  value,
  onChange,
  title = "Defesas de dano",
  description = "As mesmas regras são usadas pela ficha, compêndio e iniciativa para calcular dano automaticamente.",
}: {
  value: DamageAffinity[]
  onChange: (value: DamageAffinity[]) => void
  title?: string
  description?: string
}) {
  function patch(index: number, next: Partial<DamageAffinity>) {
    onChange(value.map((entry, current) => current === index ? { ...entry, ...next } : entry))
  }

  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-textH">{title}</div>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-textMuted">{description}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange([
            ...value,
            { damageType: "fire", kind: "resistance", qualifier: "any" },
          ])}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {value.length ? (
        <div className="mt-3 grid gap-2">
          {value.map((entry, index) => (
            <div
              key={`${entry.damageType}:${entry.kind}:${index}`}
              className="grid gap-2 rounded-lg border border-border bg-bg-subtle p-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <select
                className={selectClassName}
                value={entry.kind}
                aria-label="Reação ao dano"
                onChange={(event) => patch(index, { kind: event.target.value as DamageAffinityKind })}
              >
                <option value="resistance">{damageAffinityLabel("resistance")}</option>
                <option value="immunity">{damageAffinityLabel("immunity")}</option>
                <option value="vulnerability">{damageAffinityLabel("vulnerability")}</option>
              </select>
              <select
                className={selectClassName}
                value={entry.damageType}
                aria-label="Tipo de dano"
                onChange={(event) => patch(index, { damageType: event.target.value as DamageType })}
              >
                {DAMAGE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                className={selectClassName}
                value={entry.qualifier ?? "any"}
                aria-label="Qualificador do dano"
                onChange={(event) => patch(index, { qualifier: event.target.value as DamageAffinityQualifier })}
              >
                <option value="any">Qualquer origem</option>
                <option value="nonmagical">Somente não mágico</option>
                <option value="magical">Somente mágico</option>
              </select>
              <Button
                size="icon"
                variant="ghost"
                title="Remover defesa"
                onClick={() => onChange(value.filter((_, current) => current !== index))}
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-textMuted">
          Nenhuma imunidade, resistência ou vulnerabilidade configurada.
        </div>
      )}
    </div>
  )
}
''')

# ---------------------------------------------------------------------------
# Character sheet damage affinities.
# ---------------------------------------------------------------------------
path = "src/models/sheet/Sheet.ts"
text = read(path)
text = replace_once(
    text,
    'import type { SavingThrowProficiencies } from "./SavingThrows"\n',
    'import type { SavingThrowProficiencies } from "./SavingThrows"\nimport type { DamageAffinity } from "../combat/Damage"\n',
    "sheet damage affinity import",
)
text = replace_once(
    text,
    '  HP: HP\n  conditions?: CharacterCondition[]\n',
    '  HP: HP\n  conditions?: CharacterCondition[]\n  damageAffinities?: DamageAffinity[]\n',
    "sheet damage affinities",
)
write(path, text)

path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterProfile } from "./characterProfile"\n',
    'import type { CharacterProfile } from "./characterProfile"\nimport { normalizeDamageAffinities } from "../combat/Damage"\n',
    "character damage import",
)
text = replace_once(
    text,
    '        HP: props.sheet?.HP ?? {\n          max: 1,\n          current: 1,\n          temporary: 0,\n          hitDice: {},\n        },\n',
    '        HP: props.sheet?.HP ?? {\n          max: 1,\n          current: 1,\n          temporary: 0,\n          hitDice: {},\n        },\n        damageAffinities: normalizeDamageAffinities(props.sheet?.damageAffinities),\n',
    "character damage default",
)
write(path, text)

path = "src/features/characters/characterSheet/characterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    'import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"\n',
    'import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"\nimport { DamageAffinityEditor } from "../../combat/DamageAffinityEditor"\n',
    "character sheet editor import",
)
text = replace_once(
    text,
    '          <GroupStats character={character} updateCharacter={updateCharacter} />\n\n          <div\n',
    '''          <GroupStats character={character} updateCharacter={updateCharacter} />
          <DamageAffinityEditor
            value={character.get("sheet").damageAffinities ?? []}
            onChange={(damageAffinities) =>
              updateCharacter(character.get("id"), (current) =>
                current.withSheet("damageAffinities", damageAffinities),
              )
            }
          />

          <div
''',
    "character sheet editor placement",
)
write(path, text)

# ---------------------------------------------------------------------------
# Creature model: structured affinities + optional programmed attack data.
# ---------------------------------------------------------------------------
path = "src/models/creatures/CompendiumCreature.ts"
text = read(path)
text = 'import type { Attribute } from "../sheet/Attribute"\nimport { inferDamageAffinitiesFromLegacy, normalizeDamageAffinities, type DamageAffinity, type DamageType } from "../combat/Damage"\n\n' + text
text = replace_once(
    text,
    '''export type CreatureFeature = {
  id: string
  name: string
  description: string
}
''',
    '''export type CreatureDamagePart = {
  formula: string
  damageType: DamageType
}

export type CreatureFeatureMechanics = {
  kind: "attack"
  attackType: "weapon" | "spell" | "other"
  rangeType: "melee" | "ranged"
  attackBonus: number
  attribute?: Attribute
  magical?: boolean
  reach?: string
  damage: CreatureDamagePart[]
}

export type CreatureFeature = {
  id: string
  name: string
  description: string
  mechanics?: CreatureFeatureMechanics
}
''',
    "creature feature mechanics",
)
text = replace_once(
    text,
    '  vulnerabilities: string\n  resistances: string\n  immunities: string\n',
    '  vulnerabilities: string\n  resistances: string\n  immunities: string\n  damageAffinities: DamageAffinity[]\n',
    "creature damage affinities type",
)
text = replace_once(
    text,
    '    immunities: patch.immunities ?? "",\n    conditionImmunities: patch.conditionImmunities ?? "",\n',
    '''    immunities: patch.immunities ?? "",
    damageAffinities: normalizeDamageAffinities(
      patch.damageAffinities?.length
        ? patch.damageAffinities
        : inferDamageAffinitiesFromLegacy(patch.vulnerabilities, patch.resistances, patch.immunities),
    ),
    conditionImmunities: patch.conditionImmunities ?? "",
''',
    "creature affinity create",
)
text = replace_once(
    text,
    '    immunities: stringValue(value.immunities),\n    conditionImmunities: stringValue(value.conditionImmunities),\n',
    '''    immunities: stringValue(value.immunities),
    damageAffinities: (() => {
      const explicit = normalizeDamageAffinities(value.damageAffinities)
      return explicit.length
        ? explicit
        : inferDamageAffinitiesFromLegacy(
            stringValue(value.vulnerabilities),
            stringValue(value.resistances),
            stringValue(value.immunities),
          )
    })(),
    conditionImmunities: stringValue(value.conditionImmunities),
''',
    "creature affinity normalize",
)
text = replace_once(
    text,
    '    description: patch.description ?? "",\n  }\n}\n',
    '    description: patch.description ?? "",\n    mechanics: normalizeCreatureFeatureMechanics(patch.mechanics),\n  }\n}\n',
    "create feature mechanics",
)
text = replace_once(
    text,
    '''        createCreatureFeature({
          id: stringValue(record.id).trim() || undefined,
          name: name || `${fallbackName} ${index + 1}`,
          description,
        }),
''',
    '''        createCreatureFeature({
          id: stringValue(record.id).trim() || undefined,
          name: name || `${fallbackName} ${index + 1}`,
          description,
          mechanics: normalizeCreatureFeatureMechanics(record.mechanics),
        }),
''',
    "normalize feature mechanics",
)
insert_anchor = '''function normalizeAbilityScores(
  value: Partial<CreatureAbilityScores> | undefined,
): CreatureAbilityScores {
'''
mechanics_helpers = r'''function normalizeCreatureFeatureMechanics(value: unknown): CreatureFeatureMechanics | undefined {
  const record = asRecord(value)
  if (!record || record.kind !== "attack") return undefined
  const attackType = record.attackType === "spell" || record.attackType === "other" ? record.attackType : "weapon"
  const rangeType = record.rangeType === "ranged" ? "ranged" : "melee"
  const attribute = ["str", "dex", "con", "int", "wis", "cha"].includes(String(record.attribute))
    ? record.attribute as Attribute
    : undefined
  const damage = Array.isArray(record.damage)
    ? record.damage.flatMap((part) => {
        const partRecord = asRecord(part)
        const damageType = partRecord && ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"].includes(String(partRecord.damageType))
          ? partRecord.damageType as DamageType
          : undefined
        const formula = stringValue(partRecord?.formula).trim()
        return damageType && formula ? [{ damageType, formula }] : []
      })
    : []
  return {
    kind: "attack",
    attackType,
    rangeType,
    attackBonus: finiteNumber(record.attackBonus),
    attribute,
    magical: booleanValue(record.magical),
    reach: optionalStringValue(record.reach),
    damage,
  }
}

'''
text = replace_once(text, insert_anchor, mechanics_helpers + insert_anchor, "creature mechanics helpers")
write(path, text)

# ---------------------------------------------------------------------------
# Initiative conditions preserve the same mechanical payload as character conditions.
# ---------------------------------------------------------------------------
path = "src/models/initiative/Initiative.ts"
text = read(path)
text = 'import type { Ability } from "../abilities/Ability"\nimport type { BonusCollection } from "../bonuses/Bonus"\nimport type { SpellGrant } from "../magic/spells/SpellGrant"\nimport type { Proficiency } from "../sheet/Proficiency"\n\n' + text
text = replace_once(
    text,
    '''export type InitiativeCondition = {
  id: string
  name: string
  description?: string
  duration: InitiativeConditionDuration
}
''',
    '''export type InitiativeCondition = {
  id: string
  name: string
  description?: string
  behavior?: string
  source?: string
  notes?: string
  tags?: string[]
  bonuses?: BonusCollection
  grantedSpells?: SpellGrant[]
  grantedProficiencies?: Proficiency[]
  grantedAbilities?: Ability[]
  duration: InitiativeConditionDuration
}
''',
    "initiative condition mechanical payload",
)
text = replace_once(
    text,
    '  armorClass?: number\n  currentHp?: number\n',
    '  armorClass?: number\n  /** Manual unconditioned CA override for compendium combatants. */\n  armorClassOverride?: number\n  currentHp?: number\n',
    "initiative armor override",
)
write(path, text)

# ---------------------------------------------------------------------------
# Creature runtime adapter reuses CharacterCondition + BonusCollection engine.
# ---------------------------------------------------------------------------
write("src/models/creatures/CreatureCombatRuntime.ts", r'''import { applyBonuses, getCharacterBonuses, getScopedCharacterBonuses } from "../characters/characterStats"
import { CharacterTemplate } from "../characters/CharacterTemplate"
import type { CharacterCondition } from "../characters/CharacterCondition"
import { withCharacterConditions } from "../characters/characterConditionStorage"
import type { InitiativeCondition, InitiativeEntry } from "../initiative/Initiative"
import type { Attribute } from "../sheet/Attribute"
import type { CompendiumCreature, CreatureFeature } from "./CompendiumCreature"

export function createCreatureCombatCharacter(
  creature: CompendiumCreature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): CharacterTemplate {
  const baseArmorClass = entry?.armorClassOverride ?? creature.armorClass ?? 10
  let character = CharacterTemplate.fromJSON({
    id: `compendium:${creature.id}`,
    name: creature.name,
    unique: creature.unique,
    sheet: {
      HP: {
        max: Math.max(1, creature.maxHp ?? 1),
        current: Math.max(0, entry?.currentHp ?? creature.maxHp ?? 1),
        temporary: Math.max(0, entry?.temporaryHp ?? 0),
        hitDice: {},
      },
      stats: {
        armorClass: baseArmorClass,
        mobility: parseSpeed(creature.speed),
        initiative: creature.initiativeBonus,
        passive_perception: creature.passivePerception ?? 10,
      },
      attributes: { ...creature.abilityScores },
      skills: {},
      savingThrowProficiencies: {},
      proficiencies: [],
      race: {
        race: "custom",
        subrace: "",
        naturalAbilities: [],
        attributeBonus: {},
        proficiencies: [],
        size: "medium",
      },
      type: "monster",
      arms: 2,
      damageAffinities: creature.damageAffinities,
    },
    actionsPerTurn: {
      action: 1,
      bonusAction: 1,
      reaction: 1,
      legendaryAction: 0,
      legendaryReaction: 0,
      legendaryResistance: 0,
      interaction: 1,
      free: 999,
    },
    equipment: { rings: [], necklaces: [], weapons: [], heldItems: [], pockets: [] },
    inventory: [],
    notes: [],
    owner: { id: "", name: "", role: "master" },
    visibility: "master",
  })

  if (conditions.length) {
    character = withCharacterConditions(
      character,
      conditions.map((condition) => initiativeConditionToCharacterCondition(condition, entry?.id)),
    )
  }
  return character
}

export function getCreatureEffectiveArmorClass(
  creature: CompendiumCreature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): number {
  return createCreatureCombatCharacter(creature, conditions, entry).getEffectiveArmorClass()
}

export function getCreatureFeatureEffectiveAttackBonus(
  creature: CompendiumCreature,
  feature: CreatureFeature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): number | undefined {
  const mechanics = feature.mechanics
  if (!mechanics || mechanics.kind !== "attack") return undefined
  const character = createCreatureCombatCharacter(creature, conditions, entry)
  const attribute = mechanics.attribute ?? defaultAttackAttribute(mechanics.attackType, mechanics.rangeType)
  const scopedKey = mechanics.attackType === "spell" ? "spellAttackBonus" : mechanics.attackType === "weapon" ? "weaponAttackBonus" : undefined
  return applyBonuses(mechanics.attackBonus, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...(scopedKey ? getScopedCharacterBonuses(character, scopedKey, attribute) : []),
  ])
}

export function getCreatureFeatureEffectiveDamageBonus(
  creature: CompendiumCreature,
  feature: CreatureFeature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): number {
  const mechanics = feature.mechanics
  if (!mechanics || mechanics.kind !== "attack") return 0
  const character = createCreatureCombatCharacter(creature, conditions, entry)
  const attribute = mechanics.attribute ?? defaultAttackAttribute(mechanics.attackType, mechanics.rangeType)
  const scopedKey = mechanics.attackType === "spell" ? "spellDamageBonus" : mechanics.attackType === "weapon" ? "weaponDamageBonus" : undefined
  return applyBonuses(0, [
    ...getCharacterBonuses(character, "damageBonus"),
    ...(scopedKey ? getScopedCharacterBonuses(character, scopedKey, attribute) : []),
  ])
}

export function initiativeConditionToCharacterCondition(
  condition: InitiativeCondition,
  linkedCombatantId?: string,
): CharacterCondition {
  return {
    id: condition.id,
    name: condition.name,
    description: condition.description ?? "",
    behavior: condition.behavior ?? "",
    source: condition.source ?? "Iniciativa",
    notes: condition.notes ?? "",
    tags: condition.tags ?? ["initiative"],
    bonuses: condition.bonuses,
    grantedSpells: condition.grantedSpells,
    grantedProficiencies: condition.grantedProficiencies,
    grantedAbilities: condition.grantedAbilities,
    duration: initiativeDurationToCharacter(condition.duration),
    createdAt: new Date().toISOString(),
    linkedCombatantId,
  }
}

function initiativeDurationToCharacter(duration: InitiativeCondition["duration"]): CharacterCondition["duration"] {
  if (duration.type === "rounds" || duration.type === "turns") {
    return {
      type: duration.type,
      total: duration.remaining,
      remaining: duration.remaining,
      tickOn: "end-of-turn",
      tickOwner: "affected",
      autoRemoveAtZero: true,
    }
  }
  if (duration.type === "untilTurnStart") {
    return { type: "until-start-of-turn", tickOn: "start-of-turn", tickOwner: "source", autoRemoveAtZero: true }
  }
  if (duration.type === "untilTurnEnd") {
    return { type: "until-end-of-turn", tickOn: "end-of-turn", tickOwner: "source", autoRemoveAtZero: true }
  }
  return { type: "custom", customLabel: "Remoção manual", tickOn: "manual", autoRemoveAtZero: false }
}

function defaultAttackAttribute(
  attackType: "weapon" | "spell" | "other",
  rangeType: "melee" | "ranged",
): Attribute {
  if (attackType === "spell") return "int"
  return rangeType === "ranged" ? "dex" : "str"
}

function parseSpeed(value: string): number {
  const parsed = Number(value.match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 9
}
''')

# ---------------------------------------------------------------------------
# Creature editor: shared affinities + structured attack fields.
# ---------------------------------------------------------------------------
path = "src/features/creatures/CreatureEditorDialog.tsx"
text = read(path)
text = replace_once(
    text,
    'import { uploadImage } from "../../lib/uploadImage"\n',
    'import { uploadImage } from "../../lib/uploadImage"\nimport { DamageAffinityEditor } from "../combat/DamageAffinityEditor"\nimport { DAMAGE_TYPE_OPTIONS, type DamageType } from "../../models/combat/Damage"\n',
    "creature editor combat imports",
)
text = replace_once(
    text,
    '  type CreatureFeatureField,\n  type CreatureSide,\n',
    '  type CreatureFeatureField,\n  type CreatureFeatureMechanics,\n  type CreatureSide,\n',
    "creature mechanics import",
)
old_ref = '''            <TextInput
              label="Vulnerabilidades"
              value={draft.vulnerabilities}
              onChange={(vulnerabilities) => patch({ vulnerabilities })}
            />
            <TextInput
              label="Resistências"
              value={draft.resistances}
              onChange={(resistances) => patch({ resistances })}
            />
            <TextInput
              label="Imunidades"
              value={draft.immunities}
              onChange={(immunities) => patch({ immunities })}
            />
'''
new_ref = '''            <div className="md:col-span-2">
              <DamageAffinityEditor
                value={draft.damageAffinities}
                onChange={(damageAffinities) => patch({ damageAffinities })}
                title="Imunidades, resistências e vulnerabilidades"
                description="Estruturadas para que dano aplicado pela iniciativa seja corrigido automaticamente. Campos antigos em texto continuam sendo preservados no JSON."
              />
            </div>
'''
text = replace_once(text, old_ref, new_ref, "creature structured affinities UI")
old_desc = '''                <Field label="Descrição">
                  <Textarea
                    className="min-h-24"
                    value={feature.description}
                    placeholder="Descreva o efeito, ativação, alcance e demais regras."
                    onChange={(event) =>
                      patchFeature(feature.id, {
                        description: event.target.value,
                      })
                    }
                  />
                </Field>
'''
new_desc = old_desc + '''                <CreatureFeatureMechanicsEditor
                  value={feature.mechanics}
                  onChange={(mechanics) => patchFeature(feature.id, { mechanics })}
                />
'''
text = replace_once(text, old_desc, new_desc, "creature mechanics editor placement")
anchor = '''function SectionTitle({
  title,
  description,
}: {
'''
mechanics_component = r'''function CreatureFeatureMechanicsEditor({
  value,
  onChange,
}: {
  value?: CreatureFeatureMechanics
  onChange: (value?: CreatureFeatureMechanics) => void
}) {
  const enabled = Boolean(value)
  const current = value ?? {
    kind: "attack" as const,
    attackType: "weapon" as const,
    rangeType: "melee" as const,
    attackBonus: 0,
    attribute: "str" as const,
    magical: false,
    damage: [],
  }

  function patch(patchValue: Partial<CreatureFeatureMechanics>) {
    onChange({ ...current, ...patchValue })
  }

  return (
    <div className="rounded-lg border border-accentBorder/60 bg-accentBg/40 p-3">
      <label className="flex items-center gap-2 text-xs font-semibold text-textH">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? current : undefined)}
        />
        Estruturar mecanicamente como ataque
      </label>
      <p className="mt-1 text-[11px] leading-5 text-textMuted">
        A descrição continua livre. Estes dados permitem que condições alterem ataque/dano e preparam automações da iniciativa.
      </p>

      {enabled ? (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Field label="Origem">
              <select className={selectClassName} value={current.attackType} onChange={(event) => patch({ attackType: event.target.value as CreatureFeatureMechanics["attackType"] })}>
                <option value="weapon">Arma</option>
                <option value="spell">Magia</option>
                <option value="other">Outro</option>
              </select>
            </Field>
            <Field label="Alcance">
              <select className={selectClassName} value={current.rangeType} onChange={(event) => patch({ rangeType: event.target.value as CreatureFeatureMechanics["rangeType"] })}>
                <option value="melee">Corpo a corpo</option>
                <option value="ranged">À distância</option>
              </select>
            </Field>
            <NumberField label="Bônus de ataque" value={current.attackBonus} onChange={(attackBonus) => patch({ attackBonus: attackBonus ?? 0 })} />
            <Field label="Atributo">
              <select className={selectClassName} value={current.attribute ?? "str"} onChange={(event) => patch({ attribute: event.target.value as CreatureFeatureMechanics["attribute"] })}>
                {(["str", "dex", "con", "int", "wis", "cha"] as const).map((attribute) => <option key={attribute} value={attribute}>{attribute.toUpperCase()}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <TextInput label="Alcance/reach" value={current.reach ?? ""} placeholder="Ex.: 1,5 m ou 24/96 m" onChange={(reach) => patch({ reach })} />
            <label className="flex items-end gap-2 pb-2 text-xs text-textH">
              <input type="checkbox" checked={current.magical === true} onChange={(event) => patch({ magical: event.target.checked })} />
              Ataque mágico
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-textH">Componentes de dano</span>
              <Button size="sm" variant="ghost" onClick={() => patch({ damage: [...current.damage, { formula: "1d6", damageType: "slashing" }] })}>
                <Plus className="h-3.5 w-3.5" /> Adicionar dano
              </Button>
            </div>
            <div className="grid gap-2">
              {current.damage.map((part, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={part.formula} placeholder="1d6+2" onChange={(event) => patch({ damage: current.damage.map((item, currentIndex) => currentIndex === index ? { ...item, formula: event.target.value } : item) })} />
                  <select className={selectClassName} value={part.damageType} onChange={(event) => patch({ damage: current.damage.map((item, currentIndex) => currentIndex === index ? { ...item, damageType: event.target.value as DamageType } : item) })}>
                    {DAMAGE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <Button size="icon" variant="ghost" title="Remover dano" onClick={() => patch({ damage: current.damage.filter((_, currentIndex) => currentIndex !== index) })}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

'''
text = replace_once(text, anchor, mechanics_component + anchor, "creature mechanics component")
write(path, text)

# ---------------------------------------------------------------------------
# Quick sheet renders shared affinities and programmed attacks with condition bonuses.
# ---------------------------------------------------------------------------
path = "src/features/creatures/CreatureQuickSheet.tsx"
text = read(path)
text = replace_once(
    text,
    'import { Button } from "../../components/ui/Button"\n',
    'import { Button } from "../../components/ui/Button"\nimport { damageAffinityLabel, damageTypeLabel, type DamageAffinity } from "../../models/combat/Damage"\nimport { getCreatureEffectiveArmorClass, getCreatureFeatureEffectiveAttackBonus, getCreatureFeatureEffectiveDamageBonus } from "../../models/creatures/CreatureCombatRuntime"\n',
    "quick sheet combat imports",
)
text = replace_once(
    text,
    '''export type QuickSheetSection = {
  title: string
  content?: string
  entries?: CreatureFeature[]
}
''',
    '''export type QuickSheetFeature = CreatureFeature & {
  effectiveAttackBonus?: number
  effectiveDamageBonus?: number
}

export type QuickSheetSection = {
  title: string
  content?: string
  entries?: QuickSheetFeature[]
}
''',
    "quick sheet feature type",
)
text = replace_once(
    text,
    '  conditionImmunities?: string\n  senses?: string\n',
    '  conditionImmunities?: string\n  damageAffinities?: DamageAffinity[]\n  senses?: string\n',
    "quick sheet affinities field",
)
text = replace_once(
    text,
    '''      <div className="grid gap-3 md:grid-cols-2">
        <OptionalInfo title="Testes de resistência" content={data.savingThrows} />
''',
    '''      {data.damageAffinities?.length ? (
        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <div className="mb-2 text-sm font-semibold text-textH">Defesas de dano</div>
          <div className="flex flex-wrap gap-2">
            {data.damageAffinities.map((rule, index) => (
              <span key={`${rule.damageType}:${rule.kind}:${index}`} className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-textH">
                {damageAffinityLabel(rule.kind)} • {damageTypeLabel(rule.damageType)}{rule.qualifier && rule.qualifier !== "any" ? ` • ${rule.qualifier === "magical" ? "mágico" : "não mágico"}` : ""}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <OptionalInfo title="Testes de resistência" content={data.savingThrows} />
''',
    "quick sheet affinity display",
)
text = replace_once(
    text,
    '  entries: CreatureFeature[]\n}) {\n',
    '  entries: QuickSheetFeature[]\n}) {\n',
    "quick feature section type",
)
text = replace_once(
    text,
    '''            {entry.description.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">
                {entry.description}
              </p>
            ) : null}
''',
    '''            {entry.mechanics ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-1 font-semibold text-accent">
                  Ataque {signed(entry.effectiveAttackBonus ?? entry.mechanics.attackBonus)}
                </span>
                {entry.mechanics.reach ? <span className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-textMuted">{entry.mechanics.reach}</span> : null}
                {entry.mechanics.damage.map((part, index) => (
                  <span key={`${part.damageType}:${index}`} className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-textH">
                    {part.formula}{entry.effectiveDamageBonus ? ` ${entry.effectiveDamageBonus > 0 ? "+" : ""}${entry.effectiveDamageBonus}` : ""} {damageTypeLabel(part.damageType)}
                  </span>
                ))}
              </div>
            ) : null}
            {entry.description.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">
                {entry.description}
              </p>
            ) : null}
''',
    "quick sheet feature mechanics display",
)
# Replace creature quick sheet builder sections with enriched features and effective CA.
old_builder = '''export function quickSheetFromCompendiumCreature(
  creature: CompendiumCreature,
  entry?: InitiativeEntry,
): CombatQuickSheetData {
  return {
'''
new_builder = '''export function quickSheetFromCompendiumCreature(
  creature: CompendiumCreature,
  entry?: InitiativeEntry,
): CombatQuickSheetData {
  const conditions = entry?.conditions ?? []
  const enrich = (features: CreatureFeature[]): QuickSheetFeature[] =>
    features.map((feature) => ({
      ...feature,
      effectiveAttackBonus: getCreatureFeatureEffectiveAttackBonus(creature, feature, conditions, entry),
      effectiveDamageBonus: getCreatureFeatureEffectiveDamageBonus(creature, feature, conditions, entry),
    }))
  return {
'''
text = replace_once(text, old_builder, new_builder, "quick sheet creature runtime builder")
text = replace_once(
    text,
    '    armorClass: entry?.armorClass ?? creature.armorClass,\n',
    '    armorClass: getCreatureEffectiveArmorClass(creature, conditions, entry),\n',
    "quick sheet effective creature AC",
)
text = replace_once(
    text,
    '    conditionImmunities: creature.conditionImmunities,\n    senses: creature.senses,\n',
    '    conditionImmunities: creature.conditionImmunities,\n    damageAffinities: creature.damageAffinities,\n    senses: creature.senses,\n',
    "quick sheet creature affinities",
)
text = replace_once(
    text,
    '''      { title: "Traços e habilidades", entries: creature.traits },
      { title: "Ações", entries: creature.actions },
      { title: "Ações bônus", entries: creature.bonusActions },
      { title: "Reações", entries: creature.reactions },
      { title: "Ações lendárias", entries: creature.legendaryActions },
''',
    '''      { title: "Traços e habilidades", entries: enrich(creature.traits) },
      { title: "Ações", entries: enrich(creature.actions) },
      { title: "Ações bônus", entries: enrich(creature.bonusActions) },
      { title: "Reações", entries: enrich(creature.reactions) },
      { title: "Ações lendárias", entries: enrich(creature.legendaryActions) },
''',
    "quick sheet enriched feature sections",
)
text = replace_once(
    text,
    '    savingThrows,\n    conditions: entry?.conditions.map((condition) => condition.name),\n',
    '    savingThrows,\n    damageAffinities: sheet.damageAffinities ?? [],\n    conditions: entry?.conditions.map((condition) => condition.name),\n',
    "quick sheet character affinities",
)
write(path, text)

# ---------------------------------------------------------------------------
# Projection keeps the rich CharacterCondition mechanical payload.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/initiativeCharacterProjection.ts"
text = read(path)
text = replace_once(
    text,
    '''  return {
    id: condition.id,
    name: condition.name,
    description: condition.description || undefined,
    duration: toInitiativeDuration(condition, entryId),
  };
''',
    '''  return {
    id: condition.id,
    name: condition.name,
    description: condition.description || undefined,
    behavior: condition.behavior || undefined,
    source: condition.source || undefined,
    notes: condition.notes || undefined,
    tags: condition.tags,
    bonuses: condition.bonuses as InitiativeCondition["bonuses"],
    grantedSpells: condition.grantedSpells as InitiativeCondition["grantedSpells"],
    grantedProficiencies: condition.grantedProficiencies as InitiativeCondition["grantedProficiencies"],
    grantedAbilities: condition.grantedAbilities as InitiativeCondition["grantedAbilities"],
    duration: toInitiativeDuration(condition, entryId),
  };
''',
    "projection rich condition to initiative",
)
text = replace_once(
    text,
    '''    name: condition.name.trim(),
    description: condition.description ?? existing?.description ?? "",
    duration: toSessionDuration(condition.duration, existing?.duration),
    linkedCombatantId: entryId,
''',
    '''    name: condition.name.trim(),
    description: condition.description ?? existing?.description ?? "",
    behavior: condition.behavior ?? existing?.behavior ?? "",
    source: condition.source ?? existing?.source ?? "Iniciativa",
    notes: condition.notes ?? existing?.notes ?? "",
    tags: condition.tags ?? existing?.tags ?? ["initiative"],
    bonuses: condition.bonuses ?? existing?.bonuses,
    grantedSpells: condition.grantedSpells ?? existing?.grantedSpells,
    grantedProficiencies: condition.grantedProficiencies ?? existing?.grantedProficiencies,
    grantedAbilities: condition.grantedAbilities ?? existing?.grantedAbilities,
    duration: toSessionDuration(condition.duration, existing?.duration),
    linkedCombatantId: entryId,
''',
    "projection rich condition to session",
)
write(path, text)

print("combatant runtime core patch applied")
