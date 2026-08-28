export const DAMAGE_TYPES = [
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
