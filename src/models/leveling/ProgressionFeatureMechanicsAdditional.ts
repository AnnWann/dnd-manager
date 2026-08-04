import type {
  Ability,
  AbilityActionKind,
  AbilityEffectDuration,
  Usage,
} from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"

export function applyAdditionalProgressionFeatureMechanics(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  if (!ability.id.startsWith("progression:")) return ability

  const key = ability.id.split(":").at(-1) ?? ""
  const className = ability.acquisition?.className
  const classLevel = className ? character.getClassLevel(className) : 0
  const proficiency = character.getProficiencyBonus()
  const modifier = (attribute: Attribute) =>
    character.getEffectiveAttributeModifier(attribute)

  if (starts(key, "cunning-action")) return active(ability, "bonusAction")
  if (starts(key, "font-of-magic")) return active(ability, "bonusAction")

  if (starts(key, "spirit-shield")) {
    return active(ability, "reaction", { trigger: "whenDamaged" })
  }
  if (starts(key, "consult-the-spirits")) {
    return active(ability, "action", { max: 1, reset: "shortRest" })
  }
  if (starts(key, "raging-storm")) {
    return active(ability, "reaction", { trigger: "whenHit" })
  }
  if (starts(key, "fanatical-focus")) {
    return active(ability, "free", { max: 1, reset: "rage", trigger: "onFailedSave" })
  }
  if (starts(key, "zealous-presence")) {
    return active(ability, "bonusAction", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Até o início do seu próximo turno.",
    })
  }

  if (starts(key, "mantle-of-inspiration")) {
    return active(ability, "bonusAction")
  }
  if (starts(key, "enthralling-performance")) {
    return active(ability, "action", { max: 1, reset: "shortRest" })
  }
  if (starts(key, "mantle-of-majesty")) {
    return active(ability, "bonusAction", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto, enquanto mantiver concentração.",
    })
  }
  if (starts(key, "unbreakable-majesty")) {
    return active(ability, "bonusAction", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto ou até ficar incapacitado.",
    })
  }
  if (starts(key, "blade-flourish")) {
    return active(ability, "free", { trigger: "onHit" })
  }
  if (starts(key, "psychic-blades")) {
    return active(ability, "free", { trigger: "onHit" })
  }
  if (starts(key, "words-of-terror")) {
    return active(ability, "action", { max: 1, reset: "shortRest" })
  }
  if (starts(key, "mantle-of-whispers")) {
    return active(ability, "reaction", {
      max: 1,
      reset: "shortRest",
      trigger: "onDropToZeroHp",
      effectDuration: "lasting",
      effectDurationText: "Até usar o disfarce ou concluir um descanso longo.",
    })
  }
  if (starts(key, "shadow-lore")) {
    return active(ability, "action", { max: 1, reset: "longRest" })
  }

  if (starts(key, "blessing-of-the-forge")) {
    return active(ability, "action", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Até o fim do próximo descanso longo.",
    })
  }
  if (starts(key, "artisans-blessing")) return active(ability, "action")
  if (starts(key, "eyes-of-the-grave")) {
    return active(ability, "action", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
    })
  }
  if (starts(key, "path-to-the-grave")) return active(ability, "action")
  if (starts(key, "sentinel-at-deaths-door")) {
    return active(ability, "reaction", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
      trigger: "onCrit",
    })
  }

  if (starts(key, "balm-of-the-summer-court")) {
    return active(ability, "bonusAction", {
      maxFormula: "character.class.druid.level",
      reset: "longRest",
    })
  }
  if (starts(key, "hidden-paths")) {
    return active(ability, "bonusAction", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
    })
  }
  if (starts(key, "walker-in-dreams")) {
    return active(ability, "action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "spirit-totem")) {
    return active(ability, "bonusAction", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }

  if (starts(key, "arcane-shot")) {
    return active(ability, "free", {
      max: classLevel >= 15 ? 2 : 2,
      reset: "shortRest",
      trigger: "onHit",
    })
  }
  if (starts(key, "curving-shot")) {
    return active(ability, "bonusAction", { trigger: "onMiss" })
  }
  if (starts(key, "unwavering-mark")) {
    return active(ability, "free", { trigger: "onHit" })
  }
  if (starts(key, "warding-maneuver")) {
    return active(ability, "reaction", {
      max: Math.max(1, modifier("con")),
      reset: "longRest",
      trigger: "whenHit",
    })
  }
  if (starts(key, "ferocious-charger")) {
    return active(ability, "free", { trigger: "onHit" })
  }
  if (starts(key, "fighting-spirit")) {
    return active(ability, "bonusAction", {
      max: 3,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Até o fim do turno atual.",
    })
  }
  if (starts(key, "rapid-strike")) {
    return active(ability, "free", { trigger: "onAttack" })
  }
  if (starts(key, "strength-before-death")) {
    return active(ability, "reaction", {
      max: 1,
      reset: "longRest",
      trigger: "onDropToZeroHp",
    })
  }

  if (starts(key, "tipsy-sway")) {
    return active(ability, "reaction", { trigger: "whenMissed" })
  }
  if (starts(key, "drunkards-luck")) {
    return active(ability, "free", { trigger: "onAttack" })
  }
  if (starts(key, "sharpen-the-blade")) {
    return active(ability, "bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "radiant-sun-bolt")) return active(ability, "action")
  if (starts(key, "searing-arc-strike")) return active(ability, "bonusAction")
  if (starts(key, "searing-sunburst")) return active(ability, "action")
  if (starts(key, "sun-shield")) {
    return active(ability, "reaction", { trigger: "whenHit" })
  }

  if (starts(key, "emissary-of-peace")) {
    return active(ability, "bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "rebuke-the-violent")) {
    return active(ability, "reaction", { trigger: "whenDamaged" })
  }

  if (starts(key, "shadowy-dodge")) {
    return active(ability, "reaction", { trigger: "whenTargeted" })
  }
  if (starts(key, "detect-portal")) {
    return active(ability, "action", { max: 1, reset: "shortRest" })
  }
  if (starts(key, "planar-warrior")) return active(ability, "bonusAction")
  if (starts(key, "ethereal-step")) {
    return active(ability, "bonusAction", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Até o fim do turno atual.",
    })
  }
  if (starts(key, "spectral-defense")) {
    return active(ability, "reaction", { trigger: "whenDamaged" })
  }
  if (starts(key, "hunters-sense")) {
    return active(ability, "action", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
    })
  }
  if (starts(key, "slayers-prey")) return active(ability, "bonusAction")
  if (starts(key, "magic-users-nemesis")) {
    return active(ability, "reaction", {
      max: 1,
      reset: "shortRest",
      trigger: "onSpellCast",
    })
  }
  if (starts(key, "slayers-counter")) {
    return active(ability, "reaction", { trigger: "onSave" })
  }

  if (starts(key, "eye-for-detail")) return active(ability, "bonusAction")
  if (starts(key, "insightful-fighting")) {
    return active(ability, "bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto ou até mudar de alvo.",
    })
  }
  if (starts(key, "unerring-eye")) {
    return active(ability, "action", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
    })
  }
  if (starts(key, "master-of-tactics")) return active(ability, "bonusAction")
  if (starts(key, "skirmisher")) {
    return active(ability, "reaction", { trigger: "whenCreatureEndsTurn" })
  }
  if (starts(key, "panache")) return active(ability, "action")
  if (starts(key, "elegant-maneuver")) return active(ability, "bonusAction")
  if (starts(key, "master-duelist")) {
    return active(ability, "free", {
      max: 1,
      reset: "shortRest",
      trigger: "onMiss",
    })
  }

  if (starts(key, "eyes-of-the-dark")) return active(ability, "action")
  if (starts(key, "strength-of-the-grave")) {
    return active(ability, "free", {
      max: 1,
      reset: "longRest",
      trigger: "onDropToZeroHp",
    })
  }
  if (starts(key, "hound-of-ill-omen")) return active(ability, "bonusAction")
  if (starts(key, "shadow-walk")) return active(ability, "bonusAction")
  if (starts(key, "umbral-form")) {
    return active(ability, "bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "tempestuous-magic")) return active(ability, "bonusAction")
  if (starts(key, "storm-guide")) return active(ability, "action")
  if (starts(key, "storms-fury")) {
    return active(ability, "reaction", { trigger: "whenHit" })
  }
  if (starts(key, "wind-soul")) {
    return active(ability, "action", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 hora.",
    })
  }

  if (starts(key, "arcane-deflection")) {
    return active(ability, "reaction", { trigger: "whenHit" })
  }
  if (starts(key, "power-surge")) {
    return active(ability, "free", {
      max: Math.max(1, modifier("int")),
      reset: "longRest",
      trigger: "onSpellHit",
    })
  }

  if (starts(key, "lucky")) {
    return active(ability, "free", {
      max: 3,
      reset: "longRest",
      trigger: "onAttack",
    })
  }

  if (starts(key, "healing-light")) {
    return active(ability, "bonusAction", {
      maxFormula: "1 + character.class.warlock.level",
      reset: "longRest",
    })
  }

  if (starts(key, "additional-arcane-shot-option")) return ability
  if (starts(key, "additional-elemental-discipline")) return ability

  // Algumas características compartilham um recurso já modelado (Ki,
  // Inspiração de Bardo, Canalizar Divindade ou Pontos de Feitiçaria). Elas
  // são ativas, mas não recebem um contador independente para não duplicar o
  // mesmo recurso na ficha.
  if (
    startsAny(key, [
      "open-hand-technique",
      "shadow-arts",
      "disciple-of-the-elements",
      "additional-elemental-discipline",
      "combat-inspiration",
      "blade-flourish",
      "psychic-blades",
      "artisans-blessing",
      "path-to-the-grave",
    ])
  ) {
    return active(ability, inferSharedAction(key))
  }

  if (starts(key, "telepathic-speech")) {
    return active(ability, "bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por um número de minutos igual ao modificador de Carisma.",
    })
  }

  if (starts(key, "uneartly-recovery") || starts(key, "unearthly-recovery")) {
    return active(ability, "bonusAction", { max: 1, reset: "longRest" })
  }

  if (starts(key, "otherworldly-wings")) {
    return active(ability, "bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Até dispensar as asas ou ficar incapacitado.",
    })
  }

  if (starts(key, "arcane-shot")) {
    return active(ability, "free", {
      max: 2,
      reset: "shortRest",
      trigger: "onHit",
    })
  }

  void proficiency
  return ability
}

function active(
  ability: Ability,
  actionKind: AbilityActionKind,
  options: {
    max?: number
    maxFormula?: string
    reset?: Usage["reset"] | "rage"
    effectDuration?: AbilityEffectDuration
    effectDurationText?: string
    trigger?: string
  } = {},
): Ability {
  const reset = options.reset === "rage" ? "limited" : options.reset
  const usage =
    options.max !== undefined || options.maxFormula
      ? {
          max: options.max ?? 0,
          maxFormula: options.maxFormula,
          used: Math.min(
            options.maxFormula
              ? Number.MAX_SAFE_INTEGER
              : Math.max(0, options.max ?? 0),
            Math.max(0, ability.usage?.used ?? 0),
          ),
          reset: reset ?? "longRest",
        }
      : undefined

  return {
    ...ability,
    kind: "active",
    actionKind,
    usage,
    effectDuration: options.effectDuration ?? "instant",
    effectDurationText: options.effectDurationText,
    trigger: options.trigger,
    benefitsActive:
      options.effectDuration === "lasting"
        ? ability.benefitsActive === true
        : undefined,
    modifiersActive: undefined,
  }
}

function inferSharedAction(key: string): AbilityActionKind {
  if (starts(key, "shadow-arts")) return "action"
  if (starts(key, "combat-inspiration")) return "bonusAction"
  return "free"
}

function starts(value: string, prefix: string): boolean {
  return value === prefix || value.startsWith(`${prefix}-`)
}

function startsAny(value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => starts(value, prefix))
}
