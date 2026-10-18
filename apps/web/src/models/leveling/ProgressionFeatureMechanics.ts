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

export type ProgressionFeatureMechanics = {
  kind: Exclude<AbilityKind, "feature">
  actionKind?: AbilityActionKind
  usage?: Usage
  effectDuration: AbilityEffectDuration
  effectDurationText?: string
  trigger?: string
}

type ActiveOptions = {
  max?: number
  maxFormula?: string
  reset?: Usage["reset"]
  effectDuration?: AbilityEffectDuration
  effectDurationText?: string
  trigger?: string
}

export function getProgressionFeatureMechanics(
  character: CharacterTemplate,
  ability: Ability,
): ProgressionFeatureMechanics {
  const key = getFeatureKey(ability)
  const name = normalizeText(ability.name)
  const className = resolveAbilityClassName(ability)
  const classLevel = className ? character.getClassLevel(className) : 0
  const modifier = (attribute: Attribute) =>
    character.getEffectiveAttributeModifier(attribute)
  const proficiency = character.getProficiencyBonus()

  const active = (
    actionKind: AbilityActionKind,
    options: ActiveOptions = {},
  ): ProgressionFeatureMechanics => ({
    kind: "active",
    actionKind,
    usage: createUsage(options),
    effectDuration: options.effectDuration ?? "instant",
    effectDurationText: options.effectDurationText,
    trigger: options.trigger,
  })

  const passive = (trigger = "always"): ProgressionFeatureMechanics => ({
    kind: "passive",
    effectDuration: "lasting",
    trigger,
  })

  // Artífice
  if (starts(key, "magical-tinkering")) return active("action")
  if (starts(key, "infuse-item")) return active("action", { trigger: "onLongRest" })
  if (starts(key, "the-right-tool-for-the-job")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Até criar outro conjunto de ferramentas com esta característica.",
    })
  }
  if (starts(key, "flash-of-genius")) {
    return active("reaction", {
      max: Math.max(1, modifier("int")),
      reset: "longRest",
      trigger: "onSave",
    })
  }
  if (starts(key, "spell-storing-item")) {
    return active("action", {
      max: Math.max(2, modifier("int") * 2),
      reset: "longRest",
    })
  }

  // Bárbaro
  if (starts(key, "rage")) {
    return active("bonusAction", {
      max: rageUses(classLevel),
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText:
        "Até 1 minuto, até ficar inconsciente, até encerrar voluntariamente ou conforme as condições da Fúria.",
    })
  }
  if (starts(key, "reckless-attack")) {
    return active("free", {
      effectDuration: "lasting",
      effectDurationText: "Até o início do seu próximo turno.",
      trigger: "onAttack",
    })
  }
  if (starts(key, "frenzy")) {
    return active("bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Enquanto a Fúria atual durar.",
    })
  }
  if (starts(key, "intimidating-presence")) return active("action")
  if (starts(key, "retaliation")) {
    return active("reaction", { trigger: "whenHit" })
  }
  if (starts(key, "form-of-the-beast")) {
    return active("free", {
      effectDuration: "lasting",
      effectDurationText: "Enquanto a Fúria atual durar.",
    })
  }
  if (starts(key, "infectious-fury")) {
    return active("free", {
      max: proficiency,
      reset: "longRest",
      trigger: "onHit",
    })
  }
  if (starts(key, "call-the-hunt")) {
    return active("bonusAction", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Enquanto a Fúria atual durar.",
    })
  }
  if (starts(key, "magic-awareness")) {
    return active("action", { max: proficiency, reset: "longRest" })
  }
  if (starts(key, "bolstering-magic")) {
    return active("action", { max: proficiency, reset: "longRest" })
  }
  if (starts(key, "unstable-backlash")) {
    return active("reaction", { trigger: "whenDamaged" })
  }

  // Bardo
  if (starts(key, "bardic-inspiration")) {
    return active("bonusAction", {
      max: Math.max(1, modifier("cha")),
      reset: classLevel >= 5 ? "shortRest" : "longRest",
    })
  }
  if (starts(key, "countercharm")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Até o início do seu próximo turno.",
    })
  }
  if (starts(key, "cutting-words")) {
    return active("reaction", { trigger: "onAttack" })
  }
  if (starts(key, "peerless-skill")) {
    return active("free", { trigger: "onSkillCheck" })
  }
  if (starts(key, "performance-of-creation")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "animating-performance")) {
    return active("action", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 hora, até o objeto chegar a 0 PV ou até você morrer.",
    })
  }
  if (starts(key, "unsettling-words")) {
    return active("bonusAction", { trigger: "onFailedSave" })
  }
  if (starts(key, "universal-speech")) {
    return active("action", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 hora.",
    })
  }
  if (starts(key, "infectious-inspiration")) {
    return active("reaction", {
      max: Math.max(1, modifier("cha")),
      reset: "longRest",
    })
  }

  // Clérigo
  if (starts(key, "channel-divinity")) {
    return active("action", {
      max: channelDivinityUses(className, classLevel),
      reset: "shortRest",
    })
  }
  if (starts(key, "divine-intervention")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "knowledge-of-the-ages")) return active("action")
  if (starts(key, "read-thoughts")) return active("action")
  if (starts(key, "preserve-life")) return active("action")
  if (starts(key, "warding-flare")) {
    return active("reaction", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
      trigger: "whenTargeted",
    })
  }
  if (starts(key, "radiance-of-the-dawn")) return active("action")
  if (starts(key, "charm-animals-and-plants")) return active("action")
  if (starts(key, "wrath-of-the-storm")) {
    return active("reaction", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
      trigger: "whenHit",
    })
  }
  if (starts(key, "destructive-wrath")) {
    return active("free", { trigger: "onSpellHit" })
  }
  if (starts(key, "blessing-of-the-trickster")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 hora ou até usar esta característica novamente.",
    })
  }
  if (starts(key, "invoke-duplicity")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Por até 1 minuto, enquanto mantiver concentração.",
    })
  }
  if (starts(key, "cloak-of-shadows")) return active("action")
  if (starts(key, "war-priest")) {
    return active("bonusAction", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
      trigger: "onAttack",
    })
  }
  if (starts(key, "guided-strike") || starts(key, "war-gods-blessing")) {
    return active(starts(key, "war-gods-blessing") ? "reaction" : "free", {
      trigger: "onAttack",
    })
  }
  if (starts(key, "orders-demand")) return active("action")
  if (starts(key, "emboldening-bond")) {
    return active("action", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "balm-of-peace")) return active("action")
  if (starts(key, "eyes-of-night")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "vigilant-blessing")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Até ser usada ou até conceder a bênção a outra criatura.",
    })
  }
  if (starts(key, "twilight-sanctuary")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "steps-of-night")) {
    return active("bonusAction", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }

  // Druida
  if (starts(key, "wild-shape")) {
    return active("action", {
      max: 2,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Pela duração da Forma Selvagem ou até encerrá-la.",
    })
  }
  if (starts(key, "natural-recovery")) {
    return active("free", { max: 1, reset: "longRest", trigger: "onShortRest" })
  }
  if (starts(key, "combat-wild-shape")) return active("bonusAction")
  if (starts(key, "elemental-wild-shape")) return active("action")
  if (starts(key, "thousand-forms")) return active("action")
  if (starts(key, "halo-of-spores")) {
    return active("reaction", { trigger: "whenDamaged" })
  }
  if (starts(key, "symbiotic-entity")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos ou até perder os PV temporários concedidos.",
    })
  }
  if (starts(key, "fungal-infestation")) {
    return active("reaction", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
      trigger: "onDropToZeroHp",
    })
  }
  if (starts(key, "spreading-spores")) {
    return active("bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto ou até mover os esporos novamente.",
    })
  }
  if (starts(key, "starry-form")) {
    return active("bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "cosmic-omen")) {
    return active("reaction", {
      max: proficiency,
      reset: "longRest",
      trigger: "onAttack",
    })
  }
  if (starts(key, "summon-wildfire-spirit")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 hora, até o espírito chegar a 0 PV ou até usar novamente.",
    })
  }
  if (starts(key, "cauterizing-flames")) {
    return active("reaction", {
      max: proficiency,
      reset: "longRest",
      trigger: "onDropToZeroHp",
    })
  }
  if (starts(key, "blazing-revival")) {
    return active("free", {
      max: 1,
      reset: "longRest",
      trigger: "onDropToZeroHp",
    })
  }

  // Guerreiro
  if (starts(key, "second-wind")) {
    return active("bonusAction", { max: 1, reset: "shortRest" })
  }
  if (starts(key, "action-surge")) {
    return active("free", {
      max: classLevel >= 17 ? 2 : 1,
      reset: "shortRest",
    })
  }
  if (starts(key, "indomitable")) {
    return active("free", {
      max: classLevel >= 17 ? 3 : classLevel >= 13 ? 2 : 1,
      reset: "longRest",
      trigger: "onFailedSave",
    })
  }
  if (starts(key, "know-your-enemy")) return active("action")
  if (starts(key, "weapon-bond")) {
    return active("bonusAction", { trigger: "always" })
  }
  if (starts(key, "psionic-power")) return active("free")
  if (starts(key, "telekinetic-adept")) return active("bonusAction")
  if (starts(key, "bulwark-of-force")) {
    return active("bonusAction", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "telekinetic-master")) {
    return active("free", { max: 1, reset: "longRest" })
  }
  if (starts(key, "giants-might")) {
    return active("bonusAction", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "runic-shield")) {
    return active("reaction", {
      max: proficiency,
      reset: "longRest",
      trigger: "whenHit",
    })
  }

  // Monge
  if (starts(key, "deflect-missiles")) {
    return active("reaction", { trigger: "whenHit" })
  }
  if (starts(key, "slow-fall")) {
    return active("reaction", { trigger: "whenDamaged" })
  }
  if (starts(key, "stunning-strike")) {
    return active("free", { trigger: "onHit" })
  }
  if (starts(key, "stillness-of-mind")) return active("action")
  if (starts(key, "empty-body")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "wholeness-of-body")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "quivering-palm")) return active("action")
  if (starts(key, "shadow-step")) return active("bonusAction")
  if (starts(key, "arms-of-the-astral-self")) {
    return active("bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "visage-of-the-astral-self")) {
    return active("bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "hand-of-healing") || starts(key, "hand-of-harm")) {
    return active("free", { trigger: "onHit" })
  }
  if (starts(key, "hand-of-ultimate-mercy")) {
    return active("action", { max: 1, reset: "longRest" })
  }

  // Paladino
  if (starts(key, "divine-sense")) {
    return active("action", {
      max: Math.max(1, 1 + modifier("cha")),
      reset: "longRest",
    })
  }
  if (starts(key, "lay-on-hands")) {
    return active("action", {
      maxFormula: "character.class.paladin.level * 5",
      reset: "longRest",
    })
  }
  if (starts(key, "divine-smite")) {
    return active("free", { reset: "spellSlot", trigger: "onHit" })
  }
  if (starts(key, "cleansing-touch")) {
    return active("action", {
      max: Math.max(1, modifier("cha")),
      reset: "longRest",
    })
  }
  if (
    startsAny(key, [
      "sacred-weapon",
      "turn-the-unholy",
      "natures-wrath",
      "turn-the-faithless",
      "abjure-enemy",
      "vow-of-enmity",
      "peerless-athlete",
      "inspiring-smite",
      "watchers-will",
      "abjure-the-extraplanar",
    ])
  ) {
    return active(starts(key, "vow-of-enmity") ? "bonusAction" : "action")
  }
  if (starts(key, "glorious-defense")) {
    return active("reaction", {
      max: Math.max(1, modifier("cha")),
      reset: "longRest",
      trigger: "whenHit",
    })
  }
  if (starts(key, "vigilant-rebuke")) {
    return active("reaction", { trigger: "onSuccessfulSave" })
  }
  if (
    startsAny(key, [
      "holy-nimbus",
      "elder-champion",
      "avenging-angel",
      "living-legend",
      "mortal-bulwark",
    ])
  ) {
    return active("action", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }

  // Patrulheiro
  if (starts(key, "primeval-awareness")) {
    return active("action", { reset: "spellSlot" })
  }
  if (starts(key, "hide-in-plain-sight")) return active("action")
  if (starts(key, "writhing-tide")) {
    return active("bonusAction", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "misty-wanderer")) {
    return active("bonusAction", {
      max: Math.max(1, modifier("wis")),
      reset: "longRest",
    })
  }
  if (starts(key, "swarming-dispersal")) {
    return active("reaction", {
      max: proficiency,
      reset: "longRest",
      trigger: "whenHit",
    })
  }

  // Ladino
  if (starts(key, "uncanny-dodge")) {
    return active("reaction", { trigger: "whenHit" })
  }
  if (starts(key, "stroke-of-luck")) {
    return active("free", {
      max: 1,
      reset: "shortRest",
      trigger: "onMiss",
    })
  }
  if (starts(key, "spell-thief")) {
    return active("reaction", { max: 1, reset: "longRest", trigger: "onSave" })
  }
  if (starts(key, "wails-from-the-grave")) {
    return active("free", {
      max: proficiency,
      reset: "longRest",
      trigger: "onHit",
    })
  }
  if (starts(key, "ghost-walk")) {
    return active("bonusAction", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "psychic-veil")) {
    return active("action", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 hora ou até encerrar antecipadamente.",
    })
  }
  if (starts(key, "rend-mind")) {
    return active("action", { max: 1, reset: "longRest", trigger: "onHit" })
  }

  // Feiticeiro
  if (starts(key, "favored-by-the-gods")) {
    return active("free", {
      max: 1,
      reset: "shortRest",
      trigger: "onFailedSave",
    })
  }
  if (starts(key, "empowered-healing")) {
    return active("free", { trigger: "onSpellCast" })
  }
  if (starts(key, "revelation-in-flesh")) {
    return active("bonusAction", {
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "warping-implosion")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "restore-balance")) {
    return active("reaction", {
      max: proficiency,
      reset: "longRest",
      trigger: "onAttack",
    })
  }
  if (starts(key, "bastion-of-law")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Até os dados de proteção serem gastos ou até usar novamente.",
    })
  }
  if (starts(key, "trance-of-order")) {
    return active("bonusAction", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "clockwork-cavalcade")) {
    return active("action", { max: 1, reset: "longRest" })
  }

  // Bruxo
  if (starts(key, "eldritch-master")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "hexblades-curse")) {
    return active("bonusAction", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto ou até o alvo morrer.",
    })
  }
  if (starts(key, "accursed-specter")) {
    return active("action", {
      max: 1,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Até o fim do próximo descanso longo.",
    })
  }
  if (starts(key, "armor-of-hexes")) {
    return active("reaction", { trigger: "whenHit" })
  }
  if (starts(key, "healing-light")) {
    return active("bonusAction", {
      maxFormula: "1 + character.class.warlock.level",
      reset: "longRest",
    })
  }
  if (starts(key, "radiant-soul")) return passive("onSpellHit")
  if (starts(key, "celestial-resilience")) return passive("onShortRest")
  if (starts(key, "searing-vengeance")) {
    return active("free", {
      max: 1,
      reset: "longRest",
      trigger: "onDeathSave",
    })
  }
  if (starts(key, "genies-vessel")) return active("action")
  if (starts(key, "elemental-gift")) {
    return active("bonusAction", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 10 minutos.",
    })
  }
  if (starts(key, "limited-wish")) {
    return active("action", { max: 1, reset: "limited" })
  }
  if (starts(key, "bottled-respite")) {
    return active("action", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Pela duração permitida pela característica.",
    })
  }
  if (starts(key, "tentacle-of-the-deeps")) {
    return active("bonusAction", {
      max: proficiency,
      reset: "longRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto.",
    })
  }
  if (starts(key, "guardian-coil")) {
    return active("reaction", { trigger: "whenDamaged" })
  }
  if (starts(key, "grasping-tentacles")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "fathomless-plunge")) {
    return active("action", { max: 1, reset: "shortRest" })
  }

  // Mago
  if (starts(key, "arcane-recovery")) {
    return active("free", {
      max: 1,
      reset: "longRest",
      trigger: "onShortRest",
    })
  }
  if (starts(key, "portent")) {
    return active("free", { max: classLevel >= 14 ? 3 : 2, reset: "longRest" })
  }
  if (starts(key, "hypnotic-gaze")) return active("action")
  if (starts(key, "instinctive-charm")) {
    return active("reaction", { trigger: "whenTargeted" })
  }
  if (starts(key, "minor-conjuration")) {
    return active("action", {
      effectDuration: "lasting",
      effectDurationText: "Até sofrer dano, ser dispensado ou usar novamente.",
    })
  }
  if (starts(key, "benign-transposition")) {
    return active("action", { max: 1, reset: "longRest" })
  }
  if (starts(key, "sculpt-spells")) return passive("onSpellCast")
  if (starts(key, "overchannel")) {
    return active("free", { max: 1, reset: "longRest", trigger: "onSpellCast" })
  }

  // Ação explícita por nome para suplementos que possam usar IDs diferentes.
  if (matches(name, "maldição da lâmina maldita", "hexblade s curse")) {
    return active("bonusAction", {
      max: 1,
      reset: "shortRest",
      effectDuration: "lasting",
      effectDurationText: "Por 1 minuto ou até o alvo morrer.",
    })
  }

  return passive(inferPassiveTrigger(name))
}

export function mergeProgressionMechanics(
  ability: Ability,
  mechanics: ProgressionFeatureMechanics,
): Ability {
  const previousUsage = ability.usage
  const nextUsage = mechanics.usage
    ? {
        ...mechanics.usage,
        used: Math.min(
          getStaticUsageMaximum(mechanics.usage),
          Math.max(0, previousUsage?.used ?? mechanics.usage.used),
        ),
      }
    : undefined

  return {
    ...ability,
    kind: mechanics.kind,
    actionKind: mechanics.kind === "active" ? mechanics.actionKind : undefined,
    usage: mechanics.kind === "active" ? nextUsage : undefined,
    effectDuration: mechanics.effectDuration,
    effectDurationText: mechanics.effectDurationText,
    trigger: mechanics.trigger,
    benefitsActive:
      mechanics.kind === "active" && mechanics.effectDuration === "lasting"
        ? ability.benefitsActive === true
        : undefined,
    modifiersActive: undefined,
  }
}

function createUsage(options: ActiveOptions): Usage | undefined {
  if (
    options.max === undefined &&
    !options.maxFormula &&
    options.reset !== "spellSlot"
  ) {
    return undefined
  }
  return {
    max: options.max ?? (options.reset === "spellSlot" ? 1 : 0),
    maxFormula: options.maxFormula,
    used: 0,
    reset: options.reset ?? "longRest",
  }
}

function getStaticUsageMaximum(usage: Usage): number {
  if (usage.maxFormula) return Number.MAX_SAFE_INTEGER
  return Math.max(0, usage.max)
}

function inferPassiveTrigger(name: string): string {
  if (name.includes("aura")) return "always"
  if (name.includes("critico")) return "onCrit"
  if (name.includes("ataque furtivo")) return "onHit"
  if (name.includes("concentr")) return "whenConcentrating"
  if (name.includes("salv")) return "onSave"
  if (name.includes("iniciativa")) return "onInitiative"
  if (name.includes("descanso")) return "onShortRest"
  if (name.includes("reacao")) return "whenHit"
  return "always"
}

function channelDivinityUses(
  className: ClassName | undefined,
  level: number,
): number {
  if (className !== "cleric") return 1
  if (level >= 18) return 3
  if (level >= 6) return 2
  return 1
}

function rageUses(level: number): number {
  if (level >= 20) return 999
  if (level >= 17) return 6
  if (level >= 12) return 5
  if (level >= 6) return 4
  if (level >= 3) return 3
  return 2
}

function getFeatureKey(ability: Ability): string {
  return ability.id.split(":").at(-1) ?? normalizeText(ability.name).replace(/\s+/g, "-")
}

function resolveAbilityClassName(ability: Ability): ClassName | undefined {
  if (ability.acquisition?.className) return ability.acquisition.className
  const [, className] = ability.id.split(":")
  return isClassName(className) ? className : undefined
}

function starts(value: string, prefix: string): boolean {
  return value === prefix || value.startsWith(`${prefix}-`)
}

function startsAny(value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => starts(value, prefix))
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
