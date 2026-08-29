from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def write(path: str, content: str) -> None:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content, encoding="utf-8")


replace_once(
    "src/models/abilities/Ability.ts",
    '  | "channelDivinity"\n  | "customSystem"',
    '  | "channelDivinity"\n  | "customSpellSlot"\n  | "customSystem"',
)
replace_once(
    "src/models/abilities/Ability.ts",
    '  /** Referência para recursos de Custom Systems. */\n  systemId?: string',
    '  /** Referência para pools de espaços de uma classe customizada. */\n  poolId?: string\n  poolName?: string\n  /** Referência para recursos de Custom Systems. */\n  systemId?: string',
)

write(
    "src/models/abilities/abilityResourceCosts.ts",
    r'''import type {
  Ability,
  AbilityResourceCostDefinition,
  AbilityResourceSelection,
} from "./Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { getChannelDivinityPool, spendChannelDivinity } from "../characters/characterChannelDivinity"
import {
  getCustomSpellSlotPools,
  spendCustomSpellSlot,
} from "../characters/customClassConfig"
import { getKiPool, spendKi } from "../characters/characterKi"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"

export type AbilityResourcePaymentResult =
  | { ok: true; character: CharacterTemplate; costs: ResolvedAbilityResourceCost[] }
  | { ok: false; character: CharacterTemplate; reason: string }

export type ResolvedAbilityResourceCost = {
  cost: AbilityResourceCostDefinition
  amount: number
  slotLevel?: number
}

export function hasAbilityResourceCosts(ability: Ability): boolean {
  return (ability.resourceCosts ?? []).some((group) => group.costs.some(isConfiguredCost))
}

export function getAbilityActivationLevel(
  ability: Ability,
  selection?: AbilityResourceSelection,
): number | undefined {
  const upcast = ability.resourceUpcast
  if (!upcast?.enabled) return undefined
  const base = normalizeLevel(upcast.baseLevel, 1)
  const maximum = Math.max(base, normalizeLevel(upcast.maximumLevel, 9))
  const requested = selection?.activationLevel ?? base
  if (!Number.isInteger(requested) || requested < base || requested > maximum) return undefined
  return requested
}

export function canPayAbilityResourceCosts(
  character: CharacterTemplate,
  ability: Ability,
  selection?: AbilityResourceSelection,
): { ok: true; costs: ResolvedAbilityResourceCost[] } | { ok: false; reason: string } {
  if (!hasAbilityResourceCosts(ability)) return { ok: true, costs: [] }

  if (ability.resourceUpcast?.enabled && getAbilityActivationLevel(ability, selection) === undefined) {
    return { ok: false, reason: "Escolha um nível de ativação válido para esta habilidade." }
  }

  const plans = buildCandidatePlans(ability, selection)
  if (plans.length === 0) {
    return { ok: false, reason: "A configuração de custos da habilidade não possui uma alternativa válida." }
  }

  for (const plan of plans) {
    const resolved = resolvePlan(ability, plan, selection)
    if (resolved && canAffordPlan(character, resolved)) return { ok: true, costs: resolved }
  }

  return { ok: false, reason: "O personagem não possui recursos suficientes para pagar os custos selecionados." }
}

export function spendAbilityResourceCosts(
  character: CharacterTemplate,
  ability: Ability,
  selection?: AbilityResourceSelection,
): AbilityResourcePaymentResult {
  const validation = canPayAbilityResourceCosts(character, ability, selection)
  if (!validation.ok) return { ok: false, character, reason: validation.reason }

  let next = character
  for (const resolved of validation.costs) {
    next = spendResolvedCost(next, resolved)
  }
  return { ok: true, character: next, costs: validation.costs }
}

export function resolveAbilityResourceCostPreview(
  ability: Ability,
  cost: AbilityResourceCostDefinition,
  selection?: AbilityResourceSelection,
): ResolvedAbilityResourceCost {
  return resolveCost(ability, cost, selection)
}

export function abilityResourceCostLabel(
  cost: AbilityResourceCostDefinition,
  resolved?: Pick<ResolvedAbilityResourceCost, "amount" | "slotLevel">,
): string {
  const amount = resolved?.amount ?? normalizeAmount(cost.amount)
  const level = resolved?.slotLevel ?? cost.slotLevel
  const scale = (cost.amountPerLevel ?? 0) > 0 ? ` (+${Math.floor(cost.amountPerLevel ?? 0)}/nível)` : ""
  switch (cost.kind) {
    case "spellSlot":
      return `${amount} espaço(s) de magia — nível ${normalizeLevel(level, 1)}${scale}`
    case "pactSlot":
      return `${amount} espaço(s) de pacto${level ? ` — nível ${level}` : " — nível atual do pacto"}${scale}`
    case "customSpellSlot":
      return `${amount} espaço(s) de ${cost.poolName?.trim() || cost.poolId?.trim() || "classe customizada"} — nível ${normalizeLevel(level, 1)}${scale}`
    case "ki":
      return `${amount} Ki${scale}`
    case "sorceryPoints":
      return `${amount} ponto(s) de feitiçaria${scale}`
    case "channelDivinity":
      return `${amount} uso(s) de Canalizar Divindade${scale}`
    case "customSystem":
      return `${amount} ${cost.resourceName?.trim() || cost.resourceId?.trim() || "recurso customizado"}${scale}`
  }
}

function buildCandidatePlans(
  ability: Ability,
  selection?: AbilityResourceSelection,
): AbilityResourceCostDefinition[][] {
  let plans: AbilityResourceCostDefinition[][] = [[]]

  for (const group of ability.resourceCosts ?? []) {
    const costs = group.costs.filter(isConfiguredCost)
    if (costs.length === 0) continue

    if (group.mode === "all") {
      plans = plans.map((plan) => [...plan, ...costs])
      continue
    }

    const selectedId = selection?.alternatives?.[group.id]
    const alternatives = selectedId
      ? costs.filter((cost) => cost.id === selectedId)
      : costs
    if (alternatives.length === 0) return []

    plans = plans.flatMap((plan) => alternatives.map((cost) => [...plan, cost]))
  }

  return plans
}

function resolvePlan(
  ability: Ability,
  costs: AbilityResourceCostDefinition[],
  selection?: AbilityResourceSelection,
): ResolvedAbilityResourceCost[] | null {
  if (ability.resourceUpcast?.enabled && getAbilityActivationLevel(ability, selection) === undefined) return null
  return costs.map((cost) => resolveCost(ability, cost, selection))
}

function resolveCost(
  ability: Ability,
  cost: AbilityResourceCostDefinition,
  selection?: AbilityResourceSelection,
): ResolvedAbilityResourceCost {
  const upcast = ability.resourceUpcast
  const activationLevel = upcast?.enabled
    ? getAbilityActivationLevel(ability, selection)
    : undefined
  const baseActivationLevel = upcast?.enabled ? normalizeLevel(upcast.baseLevel, 1) : undefined
  const levelDelta = activationLevel !== undefined && baseActivationLevel !== undefined
    ? activationLevel - baseActivationLevel
    : 0
  const amount = normalizeAmount(cost.amount) + Math.max(0, Math.floor(cost.amountPerLevel ?? 0)) * levelDelta

  if (cost.kind === "pactSlot") {
    return {
      cost,
      amount,
      // Sem upcast, um custo de pacto consome o nível atual do pacto sem exigir configuração estática.
      slotLevel: upcast?.enabled ? activationLevel : undefined,
    }
  }

  if (cost.kind === "spellSlot" || cost.kind === "customSpellSlot") {
    const baseSlotLevel = normalizeLevel(cost.slotLevel, upcast?.baseLevel ?? 1)
    return {
      cost,
      amount,
      slotLevel: normalizeLevel(baseSlotLevel + levelDelta, baseSlotLevel),
    }
  }

  return { cost, amount }
}

function canAffordPlan(character: CharacterTemplate, costs: ResolvedAbilityResourceCost[]): boolean {
  const required = new Map<string, number>()
  for (const resolved of costs) {
    const key = resourceKey(resolved)
    required.set(key, (required.get(key) ?? 0) + resolved.amount)
  }

  for (const [key, amount] of required) {
    if (availableForKey(character, key) < amount) return false
  }
  return true
}

function resourceKey(resolved: ResolvedAbilityResourceCost): string {
  switch (resolved.cost.kind) {
    case "spellSlot": return `spellSlot:${resolved.slotLevel ?? 1}`
    case "pactSlot": return resolved.slotLevel ? `pactSlot:${resolved.slotLevel}` : "pactSlot:any"
    case "customSpellSlot": return `customSpellSlot:${resolved.cost.poolId ?? ""}:${resolved.slotLevel ?? 1}`
    case "ki": return "ki"
    case "sorceryPoints": return "sorceryPoints"
    case "channelDivinity": return "channelDivinity"
    case "customSystem": return `custom:${resolved.cost.systemId ?? ""}:${resolved.cost.resourceId ?? ""}`
  }
}

function availableForKey(character: CharacterTemplate, key: string): number {
  if (key.startsWith("spellSlot:")) {
    const level = Number(key.slice("spellSlot:".length)) as MagicCircleLevel
    return character.getSpellSlots()[level]?.current ?? 0
  }
  if (key.startsWith("pactSlot:")) {
    const pact = character.getPactSlots()
    if (!pact) return 0
    const suffix = key.slice("pactSlot:".length)
    return suffix === "any" || pact.level === Number(suffix) ? pact.current : 0
  }
  if (key.startsWith("customSpellSlot:")) {
    const remainder = key.slice("customSpellSlot:".length)
    const separator = remainder.lastIndexOf(":")
    if (separator < 0) return 0
    const poolId = remainder.slice(0, separator)
    const level = Number(remainder.slice(separator + 1))
    return getCustomSpellSlotPools(character).find((pool) => pool.id === poolId)?.slots[level]?.current ?? 0
  }
  if (key === "ki") return getKiPool(character)?.current ?? 0
  if (key === "sorceryPoints") return character.getSorceryPoints().current
  if (key === "channelDivinity") return getChannelDivinityPool(character)?.current ?? 0
  if (key.startsWith("custom:")) {
    const remainder = key.slice("custom:".length)
    const separator = remainder.indexOf(":")
    if (separator < 0) return 0
    const systemId = remainder.slice(0, separator)
    const resourceId = remainder.slice(separator + 1)
    const state = character.get("sheet").customSystems?.find((entry) => entry.systemId === systemId && entry.enabled)
    return Math.max(0, Number(state?.resources?.[resourceId]?.current ?? 0))
  }
  return 0
}

function spendResolvedCost(
  character: CharacterTemplate,
  resolved: ResolvedAbilityResourceCost,
): CharacterTemplate {
  let next = character
  const amount = resolved.amount

  switch (resolved.cost.kind) {
    case "spellSlot": {
      const level = (resolved.slotLevel ?? 1) as MagicCircleLevel
      for (let index = 0; index < amount; index += 1) next = next.spendSpellSlot(level)
      return next
    }
    case "pactSlot":
      for (let index = 0; index < amount; index += 1) next = next.spendPactSlot()
      return next
    case "customSpellSlot": {
      const poolId = resolved.cost.poolId?.trim()
      const level = resolved.slotLevel ?? 1
      if (!poolId) return next
      for (let index = 0; index < amount; index += 1) next = spendCustomSpellSlot(next, poolId, level)
      return next
    }
    case "ki":
      return spendKi(next, amount)
    case "sorceryPoints":
      return next.setSorceryPoints(next.getSorceryPoints().current - amount)
    case "channelDivinity":
      for (let index = 0; index < amount; index += 1) next = spendChannelDivinity(next)
      return next
    case "customSystem": {
      const systemId = resolved.cost.systemId?.trim()
      const resourceId = resolved.cost.resourceId?.trim()
      if (!systemId || !resourceId) return next
      const states = next.get("sheet").customSystems ?? []
      return next.withSheet("customSystems", states.map((state) =>
        state.systemId === systemId
          ? {
              ...state,
              resources: {
                ...state.resources,
                [resourceId]: {
                  ...state.resources[resourceId],
                  current: Math.max(0, Number(state.resources[resourceId]?.current ?? 0) - amount),
                },
              },
            }
          : state,
      ))
    }
  }
}

function isConfiguredCost(cost: AbilityResourceCostDefinition): boolean {
  if (!cost.id?.trim() || normalizeAmount(cost.amount) <= 0) return false
  if (cost.kind === "customSystem") return Boolean(cost.systemId?.trim() && cost.resourceId?.trim())
  if (cost.kind === "customSpellSlot") return Boolean(cost.poolId?.trim())
  return true
}

function normalizeAmount(value: number | undefined): number {
  return Math.max(1, Math.floor(Number(value) || 1))
}

function normalizeLevel(value: number | undefined, fallback: number): number {
  const normalized = Math.floor(Number(value) || fallback)
  return Math.min(9, Math.max(1, normalized))
}
''',
)

write(
    "src/features/characters/abilities/abilityResourceCostsEditor.tsx",
    r'''import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getCustomSpellSlotPools } from "../../../models/characters/customClassConfig"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import type {
  Ability,
  AbilityResourceCostDefinition,
  AbilityResourceCostGroup,
  AbilityResourceCostKind,
} from "../../../models/abilities/Ability"

export function AbilityResourceCostsEditor({ ability, character, onChange }: {
  ability: Ability
  character?: CharacterTemplate
  onChange: (ability: Ability) => void
}) {
  const runtime = useOptionalSessionRuntime()
  const customSystems = runtime?.runtimeConfigSnapshot?.config.customSystems ?? []
  const customSlotPools = character ? getCustomSpellSlotPools(character) : []
  const groups = ability.resourceCosts ?? []
  const upcast = ability.resourceUpcast

  function updateGroups(next: AbilityResourceCostGroup[]) {
    onChange({ ...ability, resourceCosts: next.length ? next : undefined })
  }

  function updateGroup(groupId: string, updater: (group: AbilityResourceCostGroup) => AbilityResourceCostGroup) {
    updateGroups(groups.map((group) => group.id === groupId ? updater(group) : group))
  }

  function updateCost(groupId: string, costId: string, next: AbilityResourceCostDefinition) {
    updateGroup(groupId, (group) => ({
      ...group,
      costs: group.costs.map((cost) => cost.id === costId ? next : cost),
    }))
  }

  function addGroup() {
    updateGroups([
      ...groups,
      {
        id: crypto.randomUUID(),
        mode: "all",
        costs: [createCost("spellSlot")],
      },
    ])
  }

  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-textH">Custos ao ativar</div>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-textMuted">
            Consuma espaços de magia ou pacto, pools de espaços de classes customizadas, Ki, pontos de feitiçaria, Canalizar Divindade ou recursos de Custom Systems. Grupos são combinados com E; dentro de cada grupo você escolhe E ou OU.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={addGroup}>+ Grupo de custo</Button>
      </div>

      {groups.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-textMuted">
          Nenhum recurso externo é consumido por esta habilidade.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="rounded-lg border border-border bg-bg-elevated p-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-xs font-semibold text-textH">Permitir upcast / escalonamento</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-textMuted">
                  O jogador escolhe o nível ao usar. Espaços normais e de classe customizada sobem de nível; uma alternativa de pacto usa o nível atual do pacto; outros recursos podem ganhar custo adicional por nível.
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(upcast?.enabled)}
                onChange={(event) => onChange({
                  ...ability,
                  resourceUpcast: event.target.checked
                    ? { enabled: true, baseLevel: upcast?.baseLevel ?? 1, maximumLevel: upcast?.maximumLevel ?? 9 }
                    : undefined,
                })}
              />
            </label>
            {upcast?.enabled ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Nível base da habilidade</span>
                  <Input
                    type="number"
                    min={1}
                    max={9}
                    value={upcast.baseLevel}
                    onChange={(event) => {
                      const baseLevel = clampLevel(event.target.value)
                      onChange({
                        ...ability,
                        resourceUpcast: {
                          ...upcast,
                          baseLevel,
                          maximumLevel: Math.max(baseLevel, upcast.maximumLevel ?? 9),
                        },
                      })
                    }}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Nível máximo</span>
                  <Input
                    type="number"
                    min={upcast.baseLevel}
                    max={9}
                    value={upcast.maximumLevel ?? 9}
                    onChange={(event) => onChange({
                      ...ability,
                      resourceUpcast: {
                        ...upcast,
                        maximumLevel: Math.max(upcast.baseLevel, clampLevel(event.target.value)),
                      },
                    })}
                  />
                </label>
              </div>
            ) : null}
          </div>

          {groups.map((group, groupIndex) => (
            <div key={group.id} className="rounded-xl border border-border bg-bg-elevated p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-textH">Grupo {groupIndex + 1}</div>
                  <div className="mt-0.5 text-[10px] text-textMuted">
                    {group.mode === "all" ? "E — todos os recursos abaixo são consumidos." : "OU — o jogador escolhe uma alternativa abaixo."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    className="min-w-44"
                    value={group.mode}
                    onChange={(event) => updateGroup(group.id, (current) => ({
                      ...current,
                      mode: event.target.value as "all" | "oneOf",
                    }))}
                  >
                    <option value="all">E — consumir todos</option>
                    <option value="oneOf">OU — uma alternativa</option>
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateGroup(group.id, (current) => ({
                      ...current,
                      costs: [...current.costs, createCost("spellSlot")],
                    }))}
                  >
                    + Recurso
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => updateGroups(groups.filter((item) => item.id !== group.id))}>
                    Remover grupo
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {group.costs.map((cost, costIndex) => {
                  const selectedSystem = customSystems.find((system) => system.id === cost.systemId)
                  const resources = selectedSystem?.resources ?? []
                  const selectedPool = customSlotPools.find((pool) => pool.id === cost.poolId)
                  return (
                    <div key={cost.id} className="rounded-lg border border-border bg-bg-subtle p-3">
                      <div className="grid gap-2 lg:grid-cols-[minmax(190px,1.5fr)_110px_minmax(120px,0.8fr)_auto]">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                            {group.mode === "oneOf" ? `Alternativa ${costIndex + 1}` : `Recurso ${costIndex + 1}`}
                          </span>
                          <Select
                            value={cost.kind}
                            onChange={(event) => updateCost(group.id, cost.id, resetCostKind(cost, event.target.value as AbilityResourceCostKind))}
                          >
                            <option value="spellSlot">Espaço de magia</option>
                            <option value="pactSlot">Espaço de pacto</option>
                            <option value="customSpellSlot">Espaço de classe customizada</option>
                            <option value="ki">Ki</option>
                            <option value="sorceryPoints">Pontos de feitiçaria</option>
                            <option value="channelDivinity">Canalizar Divindade</option>
                            <option value="customSystem">Recurso de Custom System</option>
                          </Select>
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Quantidade</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={cost.amount}
                            onChange={(event) => updateCost(group.id, cost.id, {
                              ...cost,
                              amount: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                            })}
                          />
                        </label>

                        {cost.kind === "spellSlot" || cost.kind === "customSpellSlot" ? (
                          <label className="grid gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Nível base do espaço</span>
                            <Input
                              type="number"
                              min={1}
                              max={9}
                              value={cost.slotLevel ?? upcast?.baseLevel ?? 1}
                              onChange={(event) => updateCost(group.id, cost.id, {
                                ...cost,
                                slotLevel: clampLevel(event.target.value),
                              })}
                            />
                          </label>
                        ) : (
                          <div className="flex items-end text-[10px] leading-4 text-textMuted">
                            {cost.kind === "pactSlot" ? "Usa o nível atual do pacto." : ""}
                          </div>
                        )}

                        <div className="flex items-end">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => updateGroup(group.id, (current) => ({
                              ...current,
                              costs: current.costs.filter((item) => item.id !== cost.id),
                            }))}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>

                      {upcast?.enabled ? (
                        <label className="mt-2 grid max-w-xs gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">+ quantidade consumida por nível</span>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={cost.amountPerLevel ?? 0}
                            onChange={(event) => updateCost(group.id, cost.id, {
                              ...cost,
                              amountPerLevel: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                            })}
                          />
                        </label>
                      ) : null}

                      {cost.kind === "customSpellSlot" ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {customSlotPools.length > 0 ? (
                            <label className="grid gap-1 sm:col-span-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Pool da classe customizada</span>
                              <Select
                                value={cost.poolId ?? ""}
                                onChange={(event) => {
                                  const pool = customSlotPools.find((item) => item.id === event.target.value)
                                  updateCost(group.id, cost.id, {
                                    ...cost,
                                    poolId: pool?.id,
                                    poolName: pool?.name,
                                  })
                                }}
                              >
                                <option value="">Selecione o pool</option>
                                {customSlotPools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name}</option>)}
                              </Select>
                              {selectedPool ? (
                                <span className="text-[10px] text-textMuted">
                                  Níveis disponíveis agora: {Object.keys(selectedPool.slots).join(", ") || "nenhum"}.
                                </span>
                              ) : null}
                            </label>
                          ) : (
                            <>
                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">ID do pool</span>
                                <Input value={cost.poolId ?? ""} onChange={(event) => updateCost(group.id, cost.id, { ...cost, poolId: event.target.value })} />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Nome do pool</span>
                                <Input value={cost.poolName ?? ""} onChange={(event) => updateCost(group.id, cost.id, { ...cost, poolName: event.target.value })} />
                              </label>
                            </>
                          )}
                        </div>
                      ) : null}

                      {cost.kind === "customSystem" ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {customSystems.length > 0 ? (
                            <>
                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Sistema</span>
                                <Select
                                  value={cost.systemId ?? ""}
                                  onChange={(event) => {
                                    const system = customSystems.find((item) => item.id === event.target.value)
                                    updateCost(group.id, cost.id, {
                                      ...cost,
                                      systemId: system?.id,
                                      systemName: system?.name,
                                      resourceId: undefined,
                                      resourceName: undefined,
                                    })
                                  }}
                                >
                                  <option value="">Selecione o sistema</option>
                                  {customSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
                                </Select>
                              </label>
                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Recurso</span>
                                <Select
                                  value={cost.resourceId ?? ""}
                                  disabled={!selectedSystem}
                                  onChange={(event) => {
                                    const resource = resources.find((item) => item.id === event.target.value)
                                    updateCost(group.id, cost.id, {
                                      ...cost,
                                      resourceId: resource?.id,
                                      resourceName: resource?.name,
                                    })
                                  }}
                                >
                                  <option value="">Selecione o recurso</option>
                                  {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                                </Select>
                              </label>
                            </>
                          ) : (
                            <>
                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">ID do sistema</span>
                                <Input value={cost.systemId ?? ""} onChange={(event) => updateCost(group.id, cost.id, { ...cost, systemId: event.target.value })} />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">ID do recurso</span>
                                <Input value={cost.resourceId ?? ""} onChange={(event) => updateCost(group.id, cost.id, { ...cost, resourceId: event.target.value })} />
                              </label>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function createCost(kind: AbilityResourceCostKind): AbilityResourceCostDefinition {
  return {
    id: crypto.randomUUID(),
    kind,
    amount: 1,
    slotLevel: kind === "spellSlot" || kind === "customSpellSlot" ? 1 : undefined,
  }
}

function resetCostKind(
  cost: AbilityResourceCostDefinition,
  kind: AbilityResourceCostKind,
): AbilityResourceCostDefinition {
  return {
    id: cost.id,
    kind,
    amount: cost.amount,
    amountPerLevel: cost.amountPerLevel,
    slotLevel: kind === "spellSlot" || kind === "customSpellSlot" ? (cost.slotLevel ?? 1) : undefined,
  }
}

function clampLevel(value: string | number): number {
  return Math.min(9, Math.max(1, Math.floor(Number(value) || 1)))
}
''',
)

replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    'import type {\n  Ability,',
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\nimport type {\n  Ability,',
)
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    '  fixedCategory?: AbilityCategory\n  onClose:',
    '  fixedCategory?: AbilityCategory\n  character?: CharacterTemplate\n  onClose:',
)
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    '  fixedCategory,\n  onClose,',
    '  fixedCategory,\n  character,\n  onClose,',
)
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    '<AbilityResourceCostsEditor ability={draft} onChange={setDraft} />',
    '<AbilityResourceCostsEditor ability={draft} character={character} onChange={setDraft} />',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '        ability={editingAbility}\n        onClose=',
    '        ability={editingAbility}\n        character={displayCharacter}\n        onClose=',
)

replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '  abilityResourceCostLabel,\n  canPayAbilityResourceCosts,',
    '  abilityResourceCostLabel,\n  canPayAbilityResourceCosts,\n  resolveAbilityResourceCostPreview,',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '''                    onChange={(event) => setAlternatives((current) => ({ ...current, [group.id]: event.target.value }))}\n                  >\n                    {group.costs.map((cost) => <option key={cost.id} value={cost.id}>{abilityResourceCostLabel(cost)}</option>)}''',
    '''                    onChange={(event) => {\n                      const cost = group.costs.find((entry) => entry.id === event.target.value)\n                      setAlternatives((current) => ({ ...current, [group.id]: event.target.value }))\n                      if (cost?.kind === "pactSlot" && ability.resourceUpcast?.enabled) {\n                        const pactLevel = character.getPactSlots()?.level\n                        if (pactLevel && pactLevel >= (baseLevel ?? 1) && pactLevel <= (maximumLevel ?? 9)) setActivationLevel(pactLevel)\n                      }\n                    }}\n                  >\n                    {group.costs.map((cost) => {\n                      const preview = resolveAbilityResourceCostPreview(ability, cost, selection)\n                      return <option key={cost.id} value={cost.id}>{abilityResourceCostLabel(cost, preview)}</option>\n                    })}''',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '{group.costs.map((cost) => <div key={cost.id}>• {abilityResourceCostLabel(cost)}</div>)}',
    '''{group.costs.map((cost) => {\n                      const preview = resolveAbilityResourceCostPreview(ability, cost, selection)\n                      return <div key={cost.id}>• {abilityResourceCostLabel(cost, preview)}</div>\n                    })}''',
)

print("Normal ability resource costs refined with custom class slot pools and pact-slot semantics.")
