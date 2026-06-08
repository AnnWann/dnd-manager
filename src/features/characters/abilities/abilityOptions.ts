import type { AbilityActionKind, AbilityKind, Trigger, AbilityUsageCooldownUnit, AbilityUsageResetKind } from "../../../models/abilities/Ability";


export const USAGE_OPTIONS: Array<{ value: AbilityUsageResetKind; label: string }> = [
  { value: "turn", label: "Por turno" },
  { value: "cooldown", label: "Cooldown" },
  { value: "shortRest", label: "Por descanso curto" },
  { value: "longRest", label: "Por descanso longo" },
]

export const COOLDOWN_UNIT_OPTIONS: Array<{ value: AbilityUsageCooldownUnit; label: string }> = [
  { value: "turns", label: "Turnos" },
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
  { value: "tenDays", label: "10 dias" },
]

export const ABILITY_KIND_OPTIONS: Array<{ value: AbilityKind; label: string }> = [
  { value: "active", label: "Ativa" },
  { value: "passive", label: "Passiva" },
]

export const ABILITY_ACTION_OPTIONS: Array<{ value: AbilityActionKind; label: string }> = [
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
  { value: "legendaryAction", label: "Ação lendária" },
  { value: "legendaryReaction", label: "Reação lendária" },
  { value: "legendaryResistance", label: "Resistência lendária" },
  { value: "free", label: "Livre" },
]

export const ABILITY_TRIGGER_OPTIONS: Array<{ value: Trigger; label: string }> = [
  { value: "always", label: "Sempre" },
  { value: "startTurn", label: "No início do turno" },
  { value: "endTurn", label: "No fim do turno" },
  { value: "startRound", label: "No início da rodada" },
  { value: "endRound", label: "No fim da rodada" },
  { value: "onAttack", label: "Ao atacar" },
  { value: "onHit", label: "Ao acertar" },
  { value: "onCrit", label: "Ao critar" },
  { value: "onMiss", label: "Ao errar" },
  { value: "whenHit", label: "Quando for atingido" },
  { value: "whenDamaged", label: "Quando sofrer dano" },
  { value: "onSpellCast", label: "Ao conjurar magia" },
  { value: "onSkillCheck", label: "Em teste de perícia" },
  { value: "onShortRest", label: "No descanso curto" },
  { value: "onLongRest", label: "No descanso longo" },
]