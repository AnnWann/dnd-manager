import { hasProgressionAbilityConfig } from "../../data/classProgression/applyProgressionAbilityConfig"
import type {
  Ability,
  AbilityActionKind,
  AbilityEffectDuration,
  AbilityKind,
  Usage,
} from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import {
  getProgressionFeatureMechanics,
  mergeProgressionMechanics,
} from "./ProgressionFeatureMechanics"

export type DefaultFeatDefinition = {
  id: string
  name: string
  description: string
  kind: Exclude<AbilityKind, "feature">
  actionKind?: AbilityActionKind
  usage?: Usage
  effectDuration?: AbilityEffectDuration
  effectDurationText?: string
  trigger?: string
}

export type CustomFeatDefinition = {
  name: string
  description: string
  kind: Exclude<AbilityKind, "feature">
  actionKind?: AbilityActionKind
  usage?: Usage
  effectDuration?: AbilityEffectDuration
  effectDurationText?: string
  trigger?: string
}

export type AsiAttributeIncrease = {
  attribute: Attribute
  amount: 1 | 2
}

export type ParsedAsiSelection =
  | { mode: "attributes"; increases: AsiAttributeIncrease[] }
  | { mode: "feat"; featId: string }
  | { mode: "customFeat"; feat: CustomFeatDefinition }

export const DEFAULT_FEATS: DefaultFeatDefinition[] = [
  {
    id: "alert",
    name: "Alerta",
    description:
      "Treinamento constante contra emboscadas. Melhora a iniciativa e reduz a capacidade de inimigos ocultos obterem vantagem contra você.",
    kind: "passive",
    trigger: "onInitiative",
  },
  {
    id: "athlete",
    name: "Atleta",
    description:
      "Aprimora condicionamento físico, recuperação após ficar caído, escalada e saltos correndo.",
    kind: "passive",
    trigger: "always",
  },
  {
    id: "charger",
    name: "Investida",
    description:
      "Permite transformar uma corrida agressiva em um ataque ou empurrão mais impactante.",
    kind: "active",
    actionKind: "bonusAction",
    effectDuration: "instant",
  },
  {
    id: "defensive-duelist",
    name: "Duelista Defensivo",
    description:
      "Ao empunhar uma arma de acuidade, usa a reação para elevar temporariamente a defesa contra um ataque corpo a corpo.",
    kind: "active",
    actionKind: "reaction",
    effectDuration: "instant",
    trigger: "whenHit",
  },
  {
    id: "dual-wielder",
    name: "Combatente com Duas Armas",
    description:
      "Aprimora o combate com duas armas, permitindo armas maiores, saque simultâneo e defesa adicional.",
    kind: "passive",
    trigger: "always",
  },
  {
    id: "durable",
    name: "Durável",
    description:
      "Aumenta a resistência e melhora a recuperação obtida ao gastar Dados de Vida.",
    kind: "passive",
    trigger: "onShortRest",
  },
  {
    id: "eldritch-adept",
    name: "Adepto Místico",
    description:
      "Concede uma Invocação Mística para a qual o personagem cumpra os pré-requisitos.",
    kind: "passive",
    trigger: "always",
  },
  {
    id: "elven-accuracy",
    name: "Precisão Élfica",
    description:
      "Refina ataques feitos com vantagem usando Destreza, Inteligência, Sabedoria ou Carisma.",
    kind: "passive",
    trigger: "onAttack",
  },
  {
    id: "great-weapon-master",
    name: "Mestre de Armas Grandes",
    description:
      "Especialização em golpes pesados, ataques arriscados e aproveitamento de críticos ou quedas de inimigos.",
    kind: "passive",
    trigger: "onAttack",
  },
  {
    id: "healer",
    name: "Curandeiro",
    description:
      "Permite usar um kit de primeiros socorros para estabilizar e restaurar pontos de vida com maior eficiência.",
    kind: "active",
    actionKind: "action",
    effectDuration: "instant",
    usage: { max: 1, used: 0, reset: "shortRest" },
  },
  {
    id: "inspiring-leader",
    name: "Líder Inspirador",
    description:
      "Após um discurso, concede pontos de vida temporários a aliados que possam ouvir e compreender você.",
    kind: "active",
    actionKind: "action",
    effectDuration: "instant",
    usage: { max: 1, used: 0, reset: "shortRest" },
  },
  {
    id: "lucky",
    name: "Sortudo",
    description:
      "Concede pontos de sorte que podem alterar jogadas importantes de ataque, teste, salvaguarda ou ataques contra você.",
    kind: "active",
    actionKind: "free",
    effectDuration: "instant",
    usage: { max: 3, used: 0, reset: "longRest" },
  },
  {
    id: "mage-slayer",
    name: "Matador de Conjuradores",
    description:
      "Treinamento para pressionar conjuradores próximos, interromper concentração e resistir a magias lançadas de perto.",
    kind: "passive",
    trigger: "onSpellCast",
  },
  {
    id: "magic-initiate",
    name: "Iniciado em Magia",
    description:
      "Concede truques e uma magia de 1º nível de uma lista de classe escolhida.",
    kind: "active",
    actionKind: "action",
    effectDuration: "instant",
    usage: { max: 1, used: 0, reset: "longRest" },
  },
  {
    id: "mobile",
    name: "Móvel",
    description:
      "Aumenta a mobilidade e facilita atravessar terreno difícil ou afastar-se de criaturas atacadas.",
    kind: "passive",
    trigger: "always",
  },
  {
    id: "observant",
    name: "Observador",
    description:
      "Aprimora percepção passiva, investigação e leitura labial.",
    kind: "passive",
    trigger: "always",
  },
  {
    id: "polearm-master",
    name: "Mestre de Armas de Haste",
    description:
      "Aprimora ataques adicionais e reações com armas de haste apropriadas.",
    kind: "passive",
    trigger: "onCreatureEntersReach",
  },
  {
    id: "resilient",
    name: "Resiliente",
    description:
      "Aumenta um atributo e concede proficiência na salvaguarda correspondente.",
    kind: "passive",
    trigger: "always",
  },
  {
    id: "sentinel",
    name: "Sentinela",
    description:
      "Permite controlar inimigos próximos com ataques de oportunidade e reações protetoras.",
    kind: "passive",
    trigger: "onCreatureLeavesReach",
  },
  {
    id: "sharpshooter",
    name: "Atirador de Elite",
    description:
      "Especialização em ataques à distância de longo alcance, cobertura e tiros arriscados de alto dano.",
    kind: "passive",
    trigger: "onAttack",
  },
  {
    id: "shield-master",
    name: "Mestre de Escudo",
    description:
      "Aprimora empurrões com escudo e defesas contra efeitos que exigem salvaguardas de Destreza.",
    kind: "passive",
    trigger: "onSave",
  },
  {
    id: "skill-expert",
    name: "Especialista em Perícias",
    description:
      "Aumenta um atributo, concede uma perícia e especialização em uma perícia na qual o personagem seja proficiente.",
    kind: "passive",
    trigger: "onSkillCheck",
  },
  {
    id: "telekinetic",
    name: "Telecinético",
    description:
      "Aprimora uma aptidão mental, concede manipulação telecinética e um empurrão à distância como ação bônus.",
    kind: "active",
    actionKind: "bonusAction",
    effectDuration: "instant",
  },
  {
    id: "tough",
    name: "Robusto",
    description:
      "Aumenta os pontos de vida máximos conforme o nível total do personagem.",
    kind: "passive",
    trigger: "always",
  },
  {
    id: "war-caster",
    name: "Conjurador de Guerra",
    description:
      "Aprimora concentração, conjuração com as mãos ocupadas e uso de magias em ataques de oportunidade.",
    kind: "passive",
    trigger: "whenConcentrating",
  },
]

const ATTRIBUTE_KEYS: Attribute[] = ["str", "dex", "con", "int", "wis", "cha"]

export function encodeAsiAttributeSelection(
  increases: AsiAttributeIncrease[],
): string {
  const compact = sanitizeIncreases(increases)
  return `asi:attributes:${compact
    .map((entry) => `${entry.attribute}=${entry.amount}`)
    .join(",")}`
}

export function encodeAsiFeatSelection(featId: string): string {
  return `asi:feat:${encodeURIComponent(featId.trim())}`
}

export function encodeCustomAsiFeatSelection(
  name: string,
  description: string,
  configuration: Partial<Omit<CustomFeatDefinition, "name" | "description">> = {},
): string {
  const feat = sanitizeCustomFeat({
    name,
    description,
    kind: configuration.kind ?? "passive",
    actionKind: configuration.actionKind,
    usage: configuration.usage,
    effectDuration: configuration.effectDuration,
    effectDurationText: configuration.effectDurationText,
    trigger: configuration.trigger,
  })
  return `asi:custom-feat-json:${encodeURIComponent(JSON.stringify(feat))}`
}

export function parseAsiSelection(
  value: string | undefined,
): ParsedAsiSelection | undefined {
  const raw = value?.trim()
  if (!raw) return undefined

  if (raw.startsWith("asi:attributes:")) {
    const increases = raw
      .slice("asi:attributes:".length)
      .split(",")
      .map((entry) => {
        const [attribute, amount] = entry.split("=")
        if (!ATTRIBUTE_KEYS.includes(attribute as Attribute)) return undefined
        const numeric = Number(amount)
        if (numeric !== 1 && numeric !== 2) return undefined
        return {
          attribute: attribute as Attribute,
          amount: numeric as 1 | 2,
        }
      })
      .filter((entry): entry is AsiAttributeIncrease => Boolean(entry))
    const sanitized = sanitizeIncreases(increases)
    return sanitized.length
      ? { mode: "attributes", increases: sanitized }
      : undefined
  }

  if (raw.startsWith("asi:feat:")) {
    const featId = decodeSafe(raw.slice("asi:feat:".length)).trim()
    return featId ? { mode: "feat", featId } : undefined
  }

  if (raw.startsWith("asi:custom-feat-json:")) {
    const decoded = decodeSafe(raw.slice("asi:custom-feat-json:".length))
    try {
      const value = JSON.parse(decoded) as Partial<CustomFeatDefinition>
      const feat = sanitizeCustomFeat(value)
      return feat.name ? { mode: "customFeat", feat } : undefined
    } catch {
      return undefined
    }
  }

  // Compatibilidade com rascunhos produzidos pela primeira versão do modal.
  if (raw.startsWith("asi:custom-feat:")) {
    const payload = raw.slice("asi:custom-feat:".length)
    const separator = payload.indexOf(":")
    if (separator < 0) return undefined
    const name = decodeSafe(payload.slice(0, separator)).trim()
    const description = decodeSafe(payload.slice(separator + 1)).trim()
    return name
      ? {
          mode: "customFeat",
          feat: sanitizeCustomFeat({
            name,
            description,
            kind: "passive",
          }),
        }
      : undefined
  }

  return undefined
}

export function finalizeProgressionFeatures(
  character: CharacterTemplate,
): CharacterTemplate {
  let next = character
  const remaining: Ability[] = []
  const createdFeats: Ability[] = []
  const attributeIncreases: AsiAttributeIncrease[] = []

  for (const ability of next.get("abilities") ?? []) {
    if (!isProgressionAsiAbility(ability)) {
      remaining.push(normalizeProgressionAbility(next, ability))
      continue
    }

    const className = resolveAbilityClassName(ability)
    const classLevel = resolveAbilityClassLevel(ability)
    if (!className || !classLevel) {
      remaining.push(normalizeProgressionAbility(next, ability))
      continue
    }

    const classEntry = next
      .get("sheet")
      .classes?.find((entry) => entry.className === className)
    const choiceId = `asi-${className}-${classLevel}`
    const selection = parseAsiSelection(classEntry?.levelChoices?.[choiceId]?.[0])

    if (!selection) {
      remaining.push(normalizeProgressionAbility(next, ability))
      continue
    }

    if (selection.mode === "attributes") {
      attributeIncreases.push(...selection.increases)
      continue
    }

    if (selection.mode === "feat") {
      const definition = DEFAULT_FEATS.find(
        (entry) => entry.id === selection.featId,
      )
      if (!definition) {
        remaining.push(normalizeProgressionAbility(next, ability))
        continue
      }
      createdFeats.push(featDefinitionToAbility(definition, ability, choiceId))
      continue
    }

    createdFeats.push(customFeatToAbility(selection.feat, ability, choiceId))
  }

  if (attributeIncreases.length) {
    const sheet = next.get("sheet")
    const attributes = { ...sheet.attributes }
    for (const increase of attributeIncreases) {
      attributes[increase.attribute] = Math.min(
        20,
        Math.max(1, attributes[increase.attribute] + increase.amount),
      )
    }
    next = next.withPatch({
      sheet: {
        ...sheet,
        attributes,
      },
    })
  }

  return next.with(
    "abilities",
    deduplicateAbilities([...remaining, ...createdFeats]),
  )
}

export function normalizeProgressionAbility(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  if (!ability.id.startsWith("progression:")) return ability
  if (ability.category === "feat") return ability
  if (hasProgressionAbilityConfig(ability)) return ability

  return mergeProgressionMechanics(
    ability,
    getProgressionFeatureMechanics(character, ability),
  )
}

function featDefinitionToAbility(
  definition: DefaultFeatDefinition,
  sourceAbility: Ability,
  choiceId: string,
): Ability {
  return {
    ...sourceAbility,
    id: `feat:${choiceId}:${definition.id}`,
    name: definition.name,
    description: definition.description,
    category: "feat",
    kind: definition.kind,
    actionKind:
      definition.kind === "active" ? definition.actionKind : undefined,
    usage:
      definition.kind === "active" && definition.usage
        ? { ...definition.usage }
        : undefined,
    effectDuration:
      definition.effectDuration ??
      (definition.kind === "active" ? "instant" : "lasting"),
    effectDurationText: definition.effectDurationText,
    trigger:
      definition.trigger ??
      (definition.kind === "passive" ? "always" : undefined),
    benefitsActive: undefined,
    modifiersActive: undefined,
  }
}

function customFeatToAbility(
  definition: CustomFeatDefinition,
  sourceAbility: Ability,
  choiceId: string,
): Ability {
  return {
    ...sourceAbility,
    id: `feat:${choiceId}:custom:${slug(definition.name)}`,
    name: definition.name,
    description:
      definition.description || "Talento personalizado obtido por ASI.",
    category: "feat",
    kind: definition.kind,
    actionKind:
      definition.kind === "active" ? definition.actionKind : undefined,
    usage:
      definition.kind === "active" && definition.usage
        ? { ...definition.usage, used: 0 }
        : undefined,
    effectDuration:
      definition.effectDuration ??
      (definition.kind === "active" ? "instant" : "lasting"),
    effectDurationText: definition.effectDurationText,
    trigger:
      definition.trigger ??
      (definition.kind === "passive" ? "always" : undefined),
    benefitsActive: undefined,
    modifiersActive: undefined,
  }
}

function sanitizeCustomFeat(
  value: Partial<CustomFeatDefinition>,
): CustomFeatDefinition {
  const kind = value.kind === "active" ? "active" : "passive"
  const max = Math.max(0, Math.trunc(Number(value.usage?.max) || 0))
  const reset = isUsageReset(value.usage?.reset)
    ? value.usage.reset
    : "longRest"
  const usage =
    kind === "active" &&
    (max > 0 || value.usage?.maxFormula?.trim() || reset === "spellSlot")
      ? {
          max: max || (reset === "spellSlot" ? 1 : 0),
          maxFormula: value.usage?.maxFormula?.trim() || undefined,
          used: 0,
          reset,
        }
      : undefined

  return {
    name: String(value.name ?? "").trim(),
    description: String(value.description ?? "").trim(),
    kind,
    actionKind:
      kind === "active" && isActionKind(value.actionKind)
        ? value.actionKind
        : kind === "active"
          ? "action"
          : undefined,
    usage,
    effectDuration:
      value.effectDuration === "lasting" ? "lasting" : "instant",
    effectDurationText:
      value.effectDuration === "lasting"
        ? value.effectDurationText?.trim() || undefined
        : undefined,
    trigger: value.trigger?.trim() || (kind === "passive" ? "always" : undefined),
  }
}

function sanitizeIncreases(
  increases: AsiAttributeIncrease[],
): AsiAttributeIncrease[] {
  const merged = new Map<Attribute, number>()
  for (const entry of increases) {
    if (!ATTRIBUTE_KEYS.includes(entry.attribute)) continue
    merged.set(
      entry.attribute,
      Math.min(2, (merged.get(entry.attribute) ?? 0) + entry.amount),
    )
  }

  const result: AsiAttributeIncrease[] = []
  let remaining = 2
  for (const attribute of ATTRIBUTE_KEYS) {
    if (remaining <= 0) break
    const amount = Math.min(remaining, merged.get(attribute) ?? 0)
    if (amount === 1 || amount === 2) {
      result.push({ attribute, amount })
      remaining -= amount
    }
  }
  return result
}

function isProgressionAsiAbility(ability: Ability): boolean {
  return (
    ability.id.startsWith("progression:") &&
    /:ability-score-improvement-\d+$/.test(ability.id)
  )
}

function resolveAbilityClassName(ability: Ability): ClassName | undefined {
  if (ability.acquisition?.className) return ability.acquisition.className
  const [, className] = ability.id.split(":")
  return isClassName(className) ? className : undefined
}

function resolveAbilityClassLevel(ability: Ability): number | undefined {
  const fromMetadata = Number(ability.acquisition?.classLevel)
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) return fromMetadata
  const match = ability.id.match(/-(\d+)$/)
  const parsed = Number(match?.[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function deduplicateAbilities(abilities: Ability[]): Ability[] {
  const byId = new Map<string, Ability>()
  for (const ability of abilities) byId.set(ability.id, ability)
  return Array.from(byId.values())
}

function isClassName(value: string | undefined): value is ClassName {
  return [
    "artificer",
    "barbarian",
    "bard",
    "cleric",
    "druid",
    "fighter",
    "monk",
    "paladin",
    "ranger",
    "rogue",
    "sorcerer",
    "warlock",
    "wizard",
  ].includes(String(value))
}

function isActionKind(value: unknown): value is AbilityActionKind {
  return [
    "action",
    "bonusAction",
    "reaction",
    "legendaryAction",
    "legendaryReaction",
    "legendaryResistance",
    "free",
  ].includes(String(value))
}

function isUsageReset(value: unknown): value is Usage["reset"] {
  return [
    "turn",
    "cooldown",
    "shortRest",
    "longRest",
    "limited",
    "spellSlot",
  ].includes(String(value))
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "talento"
}
