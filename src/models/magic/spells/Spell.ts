import type { DurationUnit } from "../../units/DurationUnit"
import type { Effect } from "../../Effects/Effect"
import type { ActionType } from "../../actions/Actions"
import type { RollType } from "../../dice/RollType"
import type { ClassName } from "../../sheet/Class"
import type { Die } from "../../dice/Die"
import type { MagicCircleLevel, MagicSchool } from "./spellDefinitions"
import type { Attribute } from "../../sheet/Attribute"
import type { DieSides } from "../../dice/Die"

export type SpellResourceType = 'ki' | 'sorceryPoints' | 'channelDivinity'
export type SpellResourceCost = { resource: SpellResourceType; amount: number }

export type Spell = {
  index: string
  name: string
  description: string
  higherLevelText: string
  displayName?: string
  headcanon?: string
  homebrew: boolean
  slotLevel: MagicCircleLevel
  school: MagicSchool | string
  classes: ClassName[]
  resourceCost?: SpellResourceCost
  rollMode: RollType[]
  castingTime: {
    value: number
    type: Exclude<ActionType, 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'interaction' | 'free'> | 'minute' | 'hour' | 'special'
    reactionWhen?: string
    special?: string
  }
  range: {
    origin: 'self' | 'touch' | 'point' | 'target' | 'ally' | 'enemy'
    distance: number
    area?: {
      shape: 'circle' | 'square' | 'cone' | 'line',
      size: number
    }
  }
  duration: {
    value: number 
    unit: DurationUnit
  }
  /** Legacy single damage die. New spells should use resolution.damage. */
  damageDice?: Die
  /** Structured mechanics used by authoritative spell casting and rolling. */
  resolution?: SpellResolution
  concentration: boolean
  ritual: boolean
  components: ('V' | 'S' | 'M')[]
  material?: string
  targeting: SpellTargeting 
  effects: Effect[]
}

export type SpellTargeting = {
  kind: 'self' | 'single-creature' | 'multiple-creatures' | 'area' | 'object' | 'special'
  targetsSelf: boolean
  targetCount?: number
  canTargetMoreAtHigherLevels?: boolean
  hasAttackRoll: boolean
  hasSavingThrow: boolean
  savingThrowAttribute?: Attribute
  affectsArea: boolean
  areaShape?: 'square' | 'circle' | 'cone' | 'line'
  areaSize?: number
}


export type SpellScalingSource = "slot-level" | "character-level"

export type SpellNumericScaling =
  | {
      type: "step"
      source: SpellScalingSource
      /** Level at which the base value applies. */
      startLevel: number
      /** Number of levels required for each increase. May be 1, 2, 3, etc. */
      interval: number
      /** Amount added on every completed interval. */
      amountPerStep: number
      maxSteps?: number
    }
  | {
      type: "thresholds"
      source: SpellScalingSource
      /** Additive increases applied when the source level reaches each threshold. */
      thresholds: Array<{ level: number; amount: number }>
    }

export type SpellScaledNumber = {
  base: number
  scaling?: SpellNumericScaling
}

export type SpellResolutionRoll =
  | { type: "none" }
  | { type: "attack" }
  | {
      type: "save"
      attribute: Attribute
      onSuccess: "none" | "half" | "full"
    }

export type SpellDamageComponent = {
  id: string
  label?: string
  damageType?: string
  dice: {
    quantity: number
    sides: DieSides
  }
  flat?: number
  /** Adds the spellcasting ability modifier to this damage component. */
  addCastingModifier?: boolean
  /**
   * Determines when this component is relevant. For attack spells, "hit"
   * applies once per successful attack instance. Save spells normally use
   * "failed-save" and describe successful-save behavior in roll.onSuccess.
   */
  appliesOn: "hit" | "failed-save" | "successful-save" | "always"
  /** Whether attack-roll critical hits double this component's dice. */
  critical?: boolean
  /** Optional additive scaling of the dice quantity. */
  diceScaling?: SpellNumericScaling
}

export type SpellResolution = {
  roll: SpellResolutionRoll
  /**
   * Independent attack/damage packets produced by one cast.
   * Examples: Scorching Ray attacks, Eldritch Blast beams, Magic Missile darts.
   */
  instances?: SpellScaledNumber
  damage?: SpellDamageComponent[]
}
