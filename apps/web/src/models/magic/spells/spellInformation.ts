import type { Spell } from "./Spell"
import { CASTING_TIME_NAMES } from "../../../contexts/consts"
import { attributeShort } from "../../../lib/attributeShorts"

export type SpellInformationEntry = { label: string; value: string }

export function getSpellInformation(spell: Spell): SpellInformationEntry[] {
  return [
    { label: "Conjuração", value: formatCastingTime(spell) },
    { label: "Alcance", value: formatRange(spell) },
    { label: "Duração", value: formatDuration(spell) },
    { label: "Componentes", value: getSpellComponents(spell).join(", ") || "Nenhum" },
    { label: "Alvo", value: formatTargeting(spell) },
    { label: "Área", value: formatArea(spell) },
    { label: "Ataque ou resistência", value: formatAttackAndSave(spell) },
    ...(spell.material?.trim() ? [{ label: "Material", value: spell.material.trim() }] : []),
    ...(spell.concentration ? [{ label: "Concentração", value: "Sim" }] : []),
    ...(spell.ritual ? [{ label: "Ritual", value: "Sim" }] : []),
  ].filter(entry => entry.value !== "Não se aplica" && entry.value !== "Nenhum")
}

export function getSpellComponents(spell: Spell): Array<"V" | "S" | "M"> {
  if (!Array.isArray(spell.components)) return []

  const order: Array<"V" | "S" | "M"> = ["V", "S", "M"]
  return order.filter((component) => spell.components.includes(component))
}

export function formatComponentsCompact(spell: Spell): string {
  const components = getSpellComponents(spell)
  return components.length
    ? `Componentes: ${components.join(", ")}`
    : "Componentes: nenhum"
}

export function formatCastingTime(spell: Spell): string {
  const castingTime = spell.castingTime
  if (castingTime.type === "special") return castingTime.special || "Especial"
  if (castingTime.type === "reaction") {
    return castingTime.reactionWhen
      ? `Reação: ${castingTime.reactionWhen}`
      : "Reação"
  }
  const label = CASTING_TIME_NAMES[castingTime.type] ?? castingTime.type
  return castingTime.value === 1
    ? `1 ${label}`
    : `${castingTime.value} ${label}s`
}

export function formatRange(spell: Spell): string {
  const { range } = spell
  if (range.origin === "self") return "Pessoal"
  if (range.origin === "touch") return "Toque"

  const originLabels: Record<string, string> = {
    point: "Ponto",
    target: "Alvo",
    ally: "Aliado",
    enemy: "Inimigo",
  }
  const origin = originLabels[range.origin] ?? range.origin
  const base = range.distance > 0 ? `${origin}, ${range.distance} m` : origin
  if (!range.area) return base
  return `${base}; ${formatAreaShape(range.area.shape)} de ${range.area.size} m`
}

export function formatDuration(spell: Spell): string {
  const { value, unit } = spell.duration
  const labels: Record<string, [string, string]> = {
    instantaneous: ["Instantânea", "Instantânea"],
    turn: ["turno", "turnos"],
    round: ["rodada", "rodadas"],
    minute: ["minuto", "minutos"],
    hour: ["hora", "horas"],
    day: ["dia", "dias"],
    special: ["Especial", "Especial"],
    untilDispelled: ["Até ser dissipada", "Até ser dissipada"],
    "short rest": ["Até o próximo descanso curto", "Até o próximo descanso curto"],
    "long rest": ["Até o próximo descanso longo", "Até o próximo descanso longo"],
    permanent: ["Permanente", "Permanente"],
  }
  const [singular, plural] = labels[unit] ?? [unit, unit]

  if (
    unit === "instantaneous" ||
    unit === "special" ||
    unit === "untilDispelled" ||
    unit === "short rest" ||
    unit === "long rest" ||
    unit === "permanent"
  ) {
    return singular
  }
  if (value <= 0) return singular
  return `${value} ${value === 1 ? singular : plural}`
}

export function formatTargeting(spell: Spell): string {
  const target = spell.targeting
  const selfSuffix = target.targetsSelf ? "; pode afetar o conjurador" : ""

  if (target.kind === "self") return "Pessoal"
  if (target.kind === "single-creature") return `Uma criatura${selfSuffix}`
  if (target.kind === "multiple-creatures") {
    const count = target.targetCount
      ? `${target.targetCount} criaturas`
      : "Múltiplas criaturas"
    return `${count}${target.canTargetMoreAtHigherLevels ? "; mais alvos em níveis superiores" : ""}${selfSuffix}`
  }
  if (target.kind === "area") return formatArea(spell)
  if (target.kind === "object") return "Objeto"
  return "Especial"
}

export function formatArea(spell: Spell): string {
  const area = spell.range.area
  if (area) return `${formatAreaShape(area.shape)} de ${area.size} m`

  if (spell.targeting.affectsArea) {
    if (spell.targeting.areaShape && spell.targeting.areaSize) {
      return `${formatAreaShape(spell.targeting.areaShape)} de ${spell.targeting.areaSize} m`
    }
    return "Área especial"
  }

  return "Não se aplica"
}

export function formatAreaShape(shape: "circle" | "square" | "cone" | "line") {
  const names = {
    circle: "círculo",
    square: "quadrado",
    cone: "cone",
    line: "linha",
  }
  return names[shape] ?? shape
}

export function formatAttackAndSave(spell: Spell): string {
  const parts: string[] = []
  if (spell.targeting.hasAttackRoll) parts.push("Jogada de ataque mágico")
  if (spell.targeting.hasSavingThrow) {
    parts.push(
      spell.targeting.savingThrowAttribute
        ? `Teste de resistência de ${attributeShort(spell.targeting.savingThrowAttribute)}`
        : "Teste de resistência",
    )
  }
  return parts.length ? parts.join("; ") : "Nenhum"
}

