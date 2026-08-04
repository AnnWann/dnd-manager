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

export type DefaultFeatDefinition = {
  id: string
  name: string
  description: string
  kind: AbilityKind
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
  | { mode: "customFeat"; name: string; description: string }

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
    usage: {
      max: 1,
      used: 0,
      reset: "shortRest",
    },
  },
  {
    id: "inspiring-leader",
    name: "Líder Inspirador",
    description:
      "Após um discurso, concede pontos de vida temporários a aliados que possam ouvir e compreender você.",
    kind: "active",
    actionKind: "action",
    effectDuration: "instant",
    usage: {
      max: 1,
      used: 0,
      reset: "shortRest",
    },
  },
  {
    id: "lucky",
    name: "Sortudo",
    description:
      "Concede pontos de sorte que podem alterar jogadas importantes de ataque, teste, salvaguarda ou ataques contra você.",
    kind: "active",
    actionKind: "free",
    effectDuration: "instant",
    usage: {
      max: 3,
      used: 0,
      reset: "longRest",
    },
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
    usage: {
      max: 1,
      used: 0,
      reset: "longRest",
    },
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
): string {
  return `asi:custom-feat:${encodeURIComponent(name.trim())}:${encodeURIComponent(
    description.trim(),
  )}`
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

  if (raw.startsWith("asi:custom-feat:")) {
    const payload = raw.slice("asi:custom-feat:".length)
    const separator = payload.indexOf(":")
    if (separator < 0) return undefined
    const name = decodeSafe(payload.slice(0, separator)).trim()
    const description = decodeSafe(payload.slice(separator + 1)).trim()
    return name ? { mode: "customFeat", name, description } : undefined
  }

  return undefined
}

export function finalizeProgressionFeatures(
  character: CharacterTemplate,
): CharacterTemplate {
  let next = character
  const abilities = [...(next.get("abilities") ?? [])]
  const remaining: Ability[] = []
  const createdFeats: Ability[] = []
  const attributeIncreases: AsiAttributeIncrease[] = []

  for (const ability of abilities) {
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

    createdFeats.push(
      normalizeProgressionAbility(next, {
        ...ability,
        id: `feat:${choiceId}:custom:${slug(selection.name)}`,
        name: selection.name,
        description:
          selection.description || "Talento personalizado obtido por ASI.",
        category: "feat",
        kind: "passive",
        actionKind: undefined,
        usage: undefined,
        effectDuration: "lasting",
        trigger: "always",
      }),
    )
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

  return next.with("abilities", deduplicateAbilities([...remaining, ...createdFeats]))
}

export function normalizeProgressionAbility(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  if (!ability.id.startsWith("progression:")) return ability
  if (ability.category === "feat") return ability

  const mechanics = getProgressionFeatureMechanics(character, ability)
  return {
    ...ability,
    kind: mechanics.kind,
    actionKind: mechanics.actionKind,
    usage: mechanics.usage,
    effectDuration: mechanics.effectDuration,
    effectDurationText: mechanics.effectDurationText,
    trigger: mechanics.trigger,
    benefitsActive:
      mechanics.kind === "active" && mechanics.effectDuration === "lasting"
        ? false
        : undefined,
  }
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
    actionKind: definition.actionKind,
    usage: definition.usage ? { ...definition.usage } : undefined,
    effectDuration:
      definition.effectDuration ??
      (definition.kind === "active" ? "instant" : "lasting"),
    effectDurationText: definition.effectDurationText,
    trigger: definition.trigger ??
      (definition.kind === "passive" ? "always" : undefined),
    benefitsActive: undefined,
  }
}

function getProgressionFeatureMechanics(
  character: CharacterTemplate,
  ability: Ability,
): {
  kind: AbilityKind
  actionKind?: AbilityActionKind
  usage?: Usage
  effectDuration: AbilityEffectDuration
  effectDurationText?: string
  trigger?: string
} {
  const name = normalizeText(ability.name)
  const className = resolveAbilityClassName(ability)
  const classLevel = className ? character.getClassLevel(className) : 0
  const attributeModifier = (attribute: Attribute) =>
    character.getEffectiveAttributeModifier(attribute)

  const active = (
    actionKind: AbilityActionKind,
    options: {
      max?: number
      maxFormula?: string
      reset?: Usage["reset"]
      effectDuration?: AbilityEffectDuration
      effectDurationText?: string
      trigger?: string
    } = {},
  ) => ({
    kind: "active" as const,
    actionKind,
    usage:
      options.max !== undefined || options.maxFormula
        ? {
            max: options.max ?? 0,
            maxFormula: options.maxFormula,
            used: 0,
            reset: options.reset ?? "longRest",
          }
        : undefined,
    effectDuration: options.effectDuration ?? "instant",
    effectDurationText: options.effectDurationText,
    trigger: options.trigger,
  })

  if (matches(name, "furia", "rage")) {
    return active("bonusAction", {
      max: rageUses(classLevel),
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Até 1 minuto, encerramento voluntário ou condição da característica.",
    })
  }
  if (matches(name, "retomar o folego", "second wind")) {
    return active("bonusAction", { max: 1, reset: "shortRest" })
  }
  if (matches(name, "surto de acao", "action surge")) {
    return active("free", {
      max: classLevel >= 17 ? 2 : 1,
      reset: "shortRest",
    })
  }
  if (matches(name, "forma selvagem", "wild shape")) {
    return active("action", {
      max: 2,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Pela duração indicada pela Forma Selvagem ou até encerrá-la.",
    })
  }
  if (matches(name, "inspiracao de bardo", "bardic inspiration")) {
    return active("bonusAction", {
      max: Math.max(1, attributeModifier("cha")),
      reset: classLevel >= 5 ? "shortRest" : "longRest",
    })
  }
  if (matches(name, "canalizar divindade", "channel divinity")) {
    const max =
      className === "cleric"
        ? classLevel >= 18
          ? 3
          : classLevel >= 6
            ? 2
            : 1
        : 1
    return active("action", { max, reset: "shortRest" })
  }
  if (matches(name, "sentido divino", "divine sense")) {
    return active("action", {
      max: Math.max(1, 1 + attributeModifier("cha")),
      reset: "longRest",
    })
  }
  if (matches(name, "imposicao das maos", "lay on hands")) {
    return active("action", {
      maxFormula: "character.class.paladin.level * 5",
      reset: "longRest",
    })
  }
  if (matches(name, "golpe divino", "divine smite")) {
    return active("free", { reset: "spellSlot", trigger: "onHit" })
  }
  if (matches(name, "recuperacao arcana", "arcane recovery")) {
    return active("free", { max: 1, reset: "longRest", trigger: "onShortRest" })
  }
  if (matches(name, "lampejo de genialidade", "flash of genius")) {
    return active("reaction", {
      max: Math.max(1, attributeModifier("int")),
      reset: "longRest",
      trigger: "onSave",
    })
  }
  if (matches(name, "desviar projeteis", "deflect missiles")) {
    return active("reaction", { trigger: "whenHit" })
  }
  if (matches(name, "queda lenta", "slow fall")) {
    return active("reaction", { trigger: "whenDamaged" })
  }
  if (matches(name, "ataque atordoante", "stunning strike")) {
    return active("free", { trigger: "onHit" })
  }
  if (matches(name, "contrafeitico", "countercharm")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Até o início do seu próximo turno.",
    })
  }
  if (matches(name, "maldição da lâmina maldita", "hexblades curse", "hexblade s curse")) {
    return active("bonusAction", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto ou até o alvo morrer.",
    })
  }
  if (matches(name, "clarão protetor", "warding flare")) {
    return active("reaction", {
      max: Math.max(1, attributeModifier("wis")),
      reset: "longRest",
      trigger: "whenTargeted",
    })
  }
  if (matches(name, "ira da tempestade", "wrath of the storm")) {
    return active("reaction", {
      max: Math.max(1, attributeModifier("wis")),
      reset: "longRest",
      trigger: "whenHit",
    })
  }
  if (matches(name, "sacerdote da guerra", "war priest")) {
    return active("bonusAction", {
      max: Math.max(1, attributeModifier("wis")),
      reset: "longRest",
      trigger: "onAttack",
    })
  }
  if (matches(name, "benção do trapaceiro", "blessing of the trickster")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 hora ou até usar novamente.",
    })
  }
  if (matches(name, "invocar duplicidade", "invoke duplicity")) {
    return active("action", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Por até 1 minuto, enquanto mantiver concentração.",
    })
  }
  if (matches(name, "manto de sombras", "cloak of shadows")) {
    return active("action", { max: 1, reset: "shortRest" })
  }
  if (matches(name, "conhecimento do inimigo", "know your enemy")) {
    return active("action")
  }
  if (matches(name, "indomavel", "indomitable")) {
    return active("free", {
      max: classLevel >= 17 ? 3 : classLevel >= 13 ? 2 : 1,
      reset: "longRest",
      trigger: "onFailedSave",
    })
  }
  if (matches(name, "evasao sobrenatural", "uncanny dodge")) {
    return active("reaction", { trigger: "whenHit" })
  }
  if (matches(name, "golpe de sorte", "stroke of luck")) {
    return active("free", {
      max: 1,
      reset: "shortRest",
      trigger: "onMiss",
    })
  }
  if (matches(name, "intervencao divina", "divine intervention")) {
    return active("action", { max: 1, reset: "longRest" })
  }

  return {
    kind: "passive",
    effectDuration: "lasting",
    trigger: inferPassiveTrigger(name),
  }
}

function inferPassiveTrigger(name: string): string {
  if (name.includes("aura")) return "always"
  if (name.includes("critico")) return "onCrit"
  if (name.includes("ataque furtivo")) return "onHit"
  if (name.includes("concentr")) return "whenConcentrating"
  if (name.includes("salv")) return "onSave"
  if (name.includes("iniciativa")) return "onInitiative"
  if (name.includes("descanso")) return "onShortRest"
  return "always"
}

function rageUses(level: number): number {
  if (level >= 20) return 999
  if (level >= 17) return 6
  if (level >= 12) return 5
  if (level >= 6) return 4
  if (level >= 3) return 3
  return 2
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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function matches(value: string, ...candidates: string[]): boolean {
  return candidates.some((candidate) => value === normalizeText(candidate))
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function slug(value: string): string {
  return normalizeText(value).replace(/\s+/g, "-") || "talento"
}
