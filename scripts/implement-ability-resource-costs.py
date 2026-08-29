from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def write(path: str, content: str) -> None:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content, encoding="utf-8")


# 1. Shared Select must always render above portaled modals.
replace_once(
    "src/components/ui/Select.tsx",
    'className="fixed z-[1000] overflow-y-auto rounded-xl border border-borderStrong bg-bg-elevated p-1 shadow-theme-lg outline-none"',
    'className="fixed z-[2147483647] overflow-y-auto rounded-xl border border-borderStrong bg-bg-elevated p-1 shadow-theme-lg outline-none"',
)

# 2. Normal abilities gain first-class composite activation costs.
replace_once(
    "src/models/abilities/Ability.ts",
    "export interface Ability {\n",
    '''export type AbilityResourceCostKind =\n  | "spellSlot"\n  | "pactSlot"\n  | "ki"\n  | "sorceryPoints"\n  | "channelDivinity"\n  | "customSystem"\n\nexport type AbilityResourceCostGroupMode = "all" | "oneOf"\n\nexport interface AbilityResourceUpcastDefinition {\n  enabled: boolean\n  /** Nível de referência da habilidade antes de escalar. */\n  baseLevel: number\n  /** Limite opcional do nível escolhido na ativação. */\n  maximumLevel?: number\n}\n\nexport interface AbilityResourceCostDefinition {\n  id: string\n  kind: AbilityResourceCostKind\n  /** Quantidade base consumida. Espaços normalmente usam 1. */\n  amount: number\n  /** Nível do espaço na ativação base. */\n  slotLevel?: number\n  /** Quantidade adicional consumida por nível de upcast. */\n  amountPerLevel?: number\n  /** Referência para recursos de Custom Systems. */\n  systemId?: string\n  resourceId?: string\n  systemName?: string\n  resourceName?: string\n}\n\nexport interface AbilityResourceCostGroup {\n  id: string\n  /** all = E; oneOf = OU. Todos os grupos, por sua vez, são cumulativos (E). */\n  mode: AbilityResourceCostGroupMode\n  costs: AbilityResourceCostDefinition[]\n}\n\nexport interface AbilityResourceSelection {\n  /** Nível escolhido quando a habilidade permite upcast/escalonamento. */\n  activationLevel?: number\n  /** Em grupos OU, mapeia groupId para o costId escolhido. */\n  alternatives?: Record<string, string>\n}\n\nexport interface Ability {\n''',
)
replace_once(
    "src/models/abilities/Ability.ts",
    "  usage?: Usage\n",
    '''  usage?: Usage\n  /** Custos externos consumidos atomicamente ao ativar a habilidade. */\n  resourceCosts?: AbilityResourceCostGroup[]\n  /** Permite escolher um nível maior no momento do uso. */\n  resourceUpcast?: AbilityResourceUpcastDefinition\n''',
)

# 3. Shared runtime for validation and atomic resource spending.
write(
    "src/models/abilities/abilityResourceCosts.ts",
    r'''import type {
  Ability,
  AbilityResourceCostDefinition,
  AbilityResourceSelection,
} from "./Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { getChannelDivinityPool, spendChannelDivinity } from "../characters/characterChannelDivinity"
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
  return (ability.resourceCosts ?? []).some((group) => group.costs.length > 0)
}

export function getAbilityActivationLevel(
  ability: Ability,
  selection?: AbilityResourceSelection,
): number | undefined {
  const upcast = ability.resourceUpcast
  if (!upcast?.enabled) return undefined
  const base = normalizeLevel(upcast.baseLevel, 1)
  const maximum = normalizeLevel(upcast.maximumLevel, 9)
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

export function abilityResourceCostLabel(cost: AbilityResourceCostDefinition): string {
  const amount = normalizeAmount(cost.amount)
  switch (cost.kind) {
    case "spellSlot":
      return `${amount} espaço(s) de magia — nível ${normalizeLevel(cost.slotLevel, 1)}`
    case "pactSlot":
      return `${amount} espaço(s) de pacto — nível base ${normalizeLevel(cost.slotLevel, 1)}`
    case "ki":
      return `${amount} Ki`
    case "sorceryPoints":
      return `${amount} ponto(s) de feitiçaria`
    case "channelDivinity":
      return `${amount} uso(s) de Canalizar Divindade`
    case "customSystem":
      return `${amount} ${cost.resourceName?.trim() || cost.resourceId?.trim() || "recurso customizado"}`
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
  const upcast = ability.resourceUpcast
  const activationLevel = upcast?.enabled
    ? getAbilityActivationLevel(ability, selection)
    : undefined
  if (upcast?.enabled && activationLevel === undefined) return null

  const baseActivationLevel = upcast?.enabled ? normalizeLevel(upcast.baseLevel, 1) : undefined
  const levelDelta = activationLevel !== undefined && baseActivationLevel !== undefined
    ? activationLevel - baseActivationLevel
    : 0

  return costs.map((cost) => {
    const amount = normalizeAmount(cost.amount) + Math.max(0, Math.floor(cost.amountPerLevel ?? 0)) * levelDelta
    const baseSlotLevel = normalizeLevel(cost.slotLevel, upcast?.baseLevel ?? 1)
    const slotLevel = cost.kind === "spellSlot" || cost.kind === "pactSlot"
      ? normalizeLevel(baseSlotLevel + levelDelta, baseSlotLevel)
      : undefined
    return { cost, amount, slotLevel }
  })
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
    case "pactSlot": return `pactSlot:${resolved.slotLevel ?? 1}`
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
    const expectedLevel = Number(key.slice("pactSlot:".length))
    const pact = character.getPactSlots()
    return pact && pact.level === expectedLevel ? pact.current : 0
  }
  if (key === "ki") return getKiPool(character)?.current ?? 0
  if (key === "sorceryPoints") return character.getSorceryPoints().current
  if (key === "channelDivinity") return getChannelDivinityPool(character)?.current ?? 0
  if (key.startsWith("custom:")) {
    const [, systemId, resourceId] = key.split(":")
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
  if (cost.kind !== "customSystem") return true
  return Boolean(cost.systemId?.trim() && cost.resourceId?.trim())
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

# 4. Editor for normal ability costs.
write(
    "src/features/characters/abilities/abilityResourceCostsEditor.tsx",
    r'''import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import type {
  Ability,
  AbilityResourceCostDefinition,
  AbilityResourceCostGroup,
  AbilityResourceCostKind,
} from "../../../models/abilities/Ability"

export function AbilityResourceCostsEditor({ ability, onChange }: {
  ability: Ability
  onChange: (ability: Ability) => void
}) {
  const runtime = useOptionalSessionRuntime()
  const customSystems = runtime?.runtimeConfigSnapshot?.config.customSystems ?? []
  const groups = ability.resourceCosts ?? []
  const upcast = ability.resourceUpcast

  function updateGroups(next: AbilityResourceCostGroup[]) {
    onChange({ ...ability, resourceCosts: next.length ? next : undefined })
  }

  function updateGroup(groupId: string, updater: (group: AbilityResourceCostGroup) => AbilityResourceCostGroup) {
    updateGroups(groups.map((group) => group.id === groupId ? updater(group) : group))
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
            Consuma espaços de magia/pacto, Ki, pontos de feitiçaria, Canalizar Divindade ou recursos de Custom Systems. Todos os grupos são cumulativos (E); grupos marcados como OU escolhem uma alternativa.
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
                  O jogador escolhe um nível ao usar. Espaços sobem de nível e custos com “+ por nível” aumentam juntos.
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
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Nível base</span>
                  <Input
                    type="number"
                    min={1}
                    max={9}
                    value={upcast.baseLevel}
                    onChange={(event) => onChange({
                      ...ability,
                      resourceUpcast: { ...upcast, baseLevel: clampLevel(event.target.value) },
                    })}
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
                    {group.mode === "all" ? "E — todos os recursos abaixo são consumidos." : "OU — apenas uma alternativa abaixo será consumida."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    className="min-w-40"
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
                  return (
                    <div key={cost.id} className="rounded-lg border border-border bg-bg-subtle p-3">
                      <div className="grid gap-2 lg:grid-cols-[minmax(180px,1.4fr)_110px_110px_auto]">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                            {group.mode === "oneOf" ? `Alternativa ${costIndex + 1}` : `Recurso ${costIndex + 1}`}
                          </span>
                          <Select
                            value={cost.kind}
                            onChange={(event) => updateCost(group.id, cost.id, {
                              ...cost,
                              kind: event.target.value as AbilityResourceCostKind,
                              systemId: undefined,
                              resourceId: undefined,
                              systemName: undefined,
                              resourceName: undefined,
                            })}
                          >
                            <option value="spellSlot">Espaço de magia</option>
                            <option value="pactSlot">Espaço de pacto</option>
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

                        {cost.kind === "spellSlot" || cost.kind === "pactSlot" ? (
                          <label className="grid gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Nível base</span>
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
                        ) : upcast?.enabled ? (
                          <label className="grid gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">+ por nível</span>
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
                        ) : <div />}

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

  function updateCost(groupId: string, costId: string, next: AbilityResourceCostDefinition) {
    updateGroup(groupId, (group) => ({
      ...group,
      costs: group.costs.map((cost) => cost.id === costId ? next : cost),
    }))
  }
}

function createCost(kind: AbilityResourceCostKind): AbilityResourceCostDefinition {
  return {
    id: crypto.randomUUID(),
    kind,
    amount: 1,
    slotLevel: kind === "spellSlot" || kind === "pactSlot" ? 1 : undefined,
  }
}

function clampLevel(value: string | number): number {
  return Math.min(9, Math.max(1, Math.floor(Number(value) || 1)))
}
''',
)

# 5. Activation modal used at play time for alternatives and upcast level.
write(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    r'''import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import type {
  Ability,
  AbilityResourceSelection,
} from "../../../models/abilities/Ability"
import {
  abilityResourceCostLabel,
  canPayAbilityResourceCosts,
} from "../../../models/abilities/abilityResourceCosts"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

export function AbilityResourceActivationModal({
  ability,
  character,
  onClose,
  onConfirm,
}: {
  ability: Ability
  character: CharacterTemplate
  onClose: () => void
  onConfirm: (optionId: string | undefined, selection: AbilityResourceSelection | undefined) => void
}) {
  const baseLevel = ability.resourceUpcast?.enabled ? Math.max(1, ability.resourceUpcast.baseLevel || 1) : undefined
  const maximumLevel = ability.resourceUpcast?.enabled
    ? Math.max(baseLevel ?? 1, Math.min(9, ability.resourceUpcast.maximumLevel ?? 9))
    : undefined
  const [activationLevel, setActivationLevel] = useState(baseLevel)
  const [optionId, setOptionId] = useState(ability.activationOptions?.[0]?.id ?? "")
  const [alternatives, setAlternatives] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (ability.resourceCosts ?? [])
        .filter((group) => group.mode === "oneOf" && group.costs[0])
        .map((group) => [group.id, group.costs[0]!.id]),
    ),
  )

  const selection = useMemo<AbilityResourceSelection | undefined>(() => {
    if (!(ability.resourceCosts?.length) && !ability.resourceUpcast?.enabled) return undefined
    return {
      activationLevel,
      alternatives: Object.keys(alternatives).length ? alternatives : undefined,
    }
  }, [ability.resourceCosts?.length, ability.resourceUpcast?.enabled, activationLevel, alternatives])

  const payment = canPayAbilityResourceCosts(character, ability, selection)
  const optionRequired = (ability.activationOptions?.length ?? 0) > 0
  const canConfirm = payment.ok && (!optionRequired || Boolean(optionId))

  return (
    <Modal title={`Usar habilidade — ${ability.name}`} onClose={onClose} className="max-w-xl">
      <div className="grid gap-4">
        {ability.activationOptions?.length ? (
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-textH">Opção da habilidade</span>
            <Select value={optionId} onChange={(event) => setOptionId(event.target.value)}>
              {ability.activationOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.ability?.name || option.name}</option>
              ))}
            </Select>
            {ability.activationOptions.find((option) => option.id === optionId)?.description ? (
              <span className="text-[11px] leading-5 text-textMuted">
                {ability.activationOptions.find((option) => option.id === optionId)?.description}
              </span>
            ) : null}
          </label>
        ) : null}

        {ability.resourceUpcast?.enabled && baseLevel !== undefined && maximumLevel !== undefined ? (
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-textH">Nível de ativação</span>
            <Select value={String(activationLevel ?? baseLevel)} onChange={(event) => setActivationLevel(Number(event.target.value))}>
              {Array.from({ length: maximumLevel - baseLevel + 1 }, (_, index) => baseLevel + index).map((level) => (
                <option key={level} value={level}>Nível {level}{level === baseLevel ? " — base" : " — upcast"}</option>
              ))}
            </Select>
          </label>
        ) : null}

        {(ability.resourceCosts ?? []).length > 0 ? (
          <div className="grid gap-2">
            <div>
              <div className="text-xs font-semibold text-textH">Recursos consumidos</div>
              <p className="mt-1 text-[11px] leading-5 text-textMuted">
                A operação só é concluída se todos os grupos obrigatórios puderem ser pagos. Nada é consumido parcialmente.
              </p>
            </div>
            {(ability.resourceCosts ?? []).map((group, index) => (
              <div key={group.id} className="rounded-lg border border-border bg-bg-subtle p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                  Grupo {index + 1} · {group.mode === "all" ? "E" : "OU"}
                </div>
                {group.mode === "oneOf" ? (
                  <Select
                    className="mt-2"
                    value={alternatives[group.id] ?? group.costs[0]?.id ?? ""}
                    onChange={(event) => setAlternatives((current) => ({ ...current, [group.id]: event.target.value }))}
                  >
                    {group.costs.map((cost) => <option key={cost.id} value={cost.id}>{abilityResourceCostLabel(cost)}</option>)}
                  </Select>
                ) : (
                  <div className="mt-2 grid gap-1 text-xs text-textH">
                    {group.costs.map((cost) => <div key={cost.id}>• {abilityResourceCostLabel(cost)}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {!payment.ok ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {payment.reason}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(optionId || undefined, selection)}
          >
            Usar habilidade
          </Button>
        </div>
      </div>
    </Modal>
  )
}
''',
)

# 6. Wire the resource editor into the normal AbilityDialog.
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    'import { AbilityAdvancedEffectsEditor } from "./abilityAdvancedEffectsEditor"\n',
    'import { AbilityAdvancedEffectsEditor } from "./abilityAdvancedEffectsEditor"\nimport { AbilityResourceCostsEditor } from "./abilityResourceCostsEditor"\n',
)
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    '  const hasConfiguredResource =\n    sharedClassResource || hasUsage || Boolean(draft.usage?.sharedResourceId)\n',
    '  const hasConfiguredResource =\n    sharedClassResource || hasUsage || Boolean(draft.usage?.sharedResourceId) || (draft.resourceCosts?.length ?? 0) > 0\n',
)
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    '''              )}\n            </div>\n          ) : null}\n\n          {tab === "effects" ? (''',
    '''              )}\n\n              <AbilityResourceCostsEditor ability={draft} onChange={setDraft} />\n            </div>\n          ) : null}\n\n          {tab === "effects" ? (''',
)

# 7. Client protocol carries the chosen cost branch/upcast level.
replace_once(
    "src/features/session-runtime/abilitySessionProtocol.ts",
    'import type { Ability } from "../../models/abilities/Ability"\n',
    'import type { Ability, AbilityResourceSelection } from "../../models/abilities/Ability"\n',
)
replace_once(
    "src/features/session-runtime/abilitySessionProtocol.ts",
    '      activationOptionId?: string\n',
    '      activationOptionId?: string\n      resourceSelection?: AbilityResourceSelection\n',
)

# 8. Replace the old option-only modal with the unified ability activation modal and spend resources offline too.
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    'import { Modal } from "../../../components/ui/Modal"\n',
    '',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    'import type { Ability } from "../../../models/abilities/Ability"\n',
    'import type { Ability, AbilityResourceSelection } from "../../../models/abilities/Ability"\n',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    'import { AbilityDialog } from "./abilityDialog"\n',
    'import { AbilityDialog } from "./abilityDialog"\nimport { AbilityResourceActivationModal } from "./abilityResourceActivationModal"\nimport { hasAbilityResourceCosts, spendAbilityResourceCosts } from "../../../models/abilities/abilityResourceCosts"\n',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '''  function requestUseAbility(ability: Ability) {\n    if ((ability.activationOptions?.length ?? 0) > 0) {\n      setActivationChoice(ability)\n      return\n    }\n    useAbility(ability.id)\n  }\n\n  function useAbility(id: string, optionId?: string) {''',
    '''  function requestUseAbility(ability: Ability) {\n    if ((ability.activationOptions?.length ?? 0) > 0 || hasAbilityResourceCosts(ability) || ability.resourceUpcast?.enabled) {\n      setActivationChoice(ability)\n      return\n    }\n    useAbility(ability.id)\n  }\n\n  function useAbility(id: string, optionId?: string, resourceSelection?: AbilityResourceSelection) {''',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '''        source,\n        activationOptionId: optionId,\n      })) {''',
    '''        source,\n        activationOptionId: optionId,\n        resourceSelection,\n      })) {''',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '''    updateCharacter(displayCharacter.get("id"), (current) => {\n      if (ability && isEquipmentAbility(ability)) {\n        return current.useEquipmentAbility(ability.sourceItemId, ability.originalAbilityId)\n      }\n\n      if (ability && isRaceAbility(ability)) {\n        return updateRaceAbilityState(\n          current,\n          ability.originalAbilityId,\n          "use",\n          optionId,\n        )\n      }\n\n      return useCharacterAbility(current, id, optionId)\n    })''',
    '''    updateCharacter(displayCharacter.get("id"), (current) => {\n      const payment = ability\n        ? spendAbilityResourceCosts(current, ability, resourceSelection)\n        : { ok: true as const, character: current, costs: [] }\n      if (!payment.ok) return current\n      const paidCharacter = payment.character\n\n      if (ability && isEquipmentAbility(ability)) {\n        return paidCharacter.useEquipmentAbility(ability.sourceItemId, ability.originalAbilityId)\n      }\n\n      if (ability && isRaceAbility(ability)) {\n        return updateRaceAbilityState(\n          paidCharacter,\n          ability.originalAbilityId,\n          "use",\n          optionId,\n        )\n      }\n\n      return useCharacterAbility(paidCharacter, id, optionId)\n    })''',
)
# Replace the entire old activation-choice Modal block.
start = '      {activationChoice ? (\n        <Modal\n          title={`Escolher habilidade — ${activationChoice.name}`}\n'
file = Path("src/features/characters/abilities/characterAbilities.tsx")
text = file.read_text(encoding="utf-8")
start_index = text.find(start)
if start_index < 0:
    raise RuntimeError("Old activation modal start not found")
end_marker = '      ) : null}\n    </>'
end_index = text.find(end_marker, start_index)
if end_index < 0:
    raise RuntimeError("Old activation modal end not found")
replacement = '''      {activationChoice ? (\n        <AbilityResourceActivationModal\n          ability={activationChoice}\n          character={displayCharacter}\n          onClose={() => setActivationChoice(null)}\n          onConfirm={(optionId, resourceSelection) => useAbility(activationChoice.id, optionId, resourceSelection)}\n        />\n      ) : null}\n    </>'''
text = text[:start_index] + replacement + text[end_index + len(end_marker):]
file.write_text(text, encoding="utf-8")

# 9. Server protocol validates the same selection shape.
replace_once(
    "session-server/src/routes/characters/abilities/abilityProtocol.ts",
    'export type SessionAbilitySource =\n',
    'import type { AbilityResourceSelection } from "../../../../../src/models/abilities/Ability";\n\nexport type SessionAbilitySource =\n',
)
replace_once(
    "session-server/src/routes/characters/abilities/abilityProtocol.ts",
    '      activationOptionId?: string;\n',
    '      activationOptionId?: string;\n      resourceSelection?: AbilityResourceSelection;\n',
)
replace_once(
    "session-server/src/routes/characters/abilities/abilityProtocol.ts",
    '''        hasValidOptionalName &&\n        (value.activationOptionId === undefined || typeof value.activationOptionId === "string");''',
    '''        hasValidOptionalName &&\n        (value.activationOptionId === undefined || typeof value.activationOptionId === "string") &&\n        (value.resourceSelection === undefined || isResourceSelection(value.resourceSelection));''',
)
replace_once(
    "session-server/src/routes/characters/abilities/abilityProtocol.ts",
    'function isAbilityName(value: unknown): value is string {\n',
    '''function isResourceSelection(value: unknown): value is AbilityResourceSelection {\n  if (!isRecord(value)) return false;\n  if (value.activationLevel !== undefined && (!Number.isInteger(value.activationLevel) || value.activationLevel < 1 || value.activationLevel > 9)) {\n    return false;\n  }\n  if (value.alternatives !== undefined) {\n    if (!isRecord(value.alternatives)) return false;\n    for (const [groupId, costId] of Object.entries(value.alternatives)) {\n      if (!groupId.trim() || typeof costId !== "string" || !costId.trim()) return false;\n    }\n  }\n  return true;\n}\n\nfunction isAbilityName(value: unknown): value is string {\n''',
)

# 10. Server applies the cost atomically before the existing semantic ability use.
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''import {\n  endAbilityEffect,\n  restoreAbilityUse,\n  useAbilityEffect,\n} from "../../../../../src/models/abilities/abilityActivation";''',
    '''import {\n  canActivateAbility,\n  endAbilityEffect,\n  restoreAbilityUse,\n  useAbilityEffect,\n} from "../../../../../src/models/abilities/abilityActivation";\nimport { spendAbilityResourceCosts } from "../../../../../src/models/abilities/abilityResourceCosts";\nimport { getChannelDivinityPool } from "../../../../../src/models/characters/characterChannelDivinity";\nimport { getKiPool } from "../../../../../src/models/characters/characterKi";''',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''  const { source } = operation;\n  switch (source.type) {''',
    '''  const { source } = operation;\n  let nextCharacter = character;\n  if (operation.type === "character.ability.use") {\n    const ability = findAbilityForSource(character, source);\n    if (!ability || !canActivateAbility(character, ability)) return null;\n    if ((source.type === "character" || source.type === "condition") && ability.category === "channelDivinity" && (getChannelDivinityPool(character)?.current ?? 0) <= 0) return null;\n    if ((source.type === "character" || source.type === "condition") && ability.category === "martialArts" && (getKiPool(character)?.current ?? 0) <= 0) return null;\n    const payment = spendAbilityResourceCosts(character, ability, operation.resourceSelection);\n    if (!payment.ok) return null;\n    nextCharacter = payment.character;\n  }\n\n  switch (source.type) {''',
)
# Apply the existing semantic use to the paid character, while restore/deactivate keep original semantics.
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '        return character.useAbility(source.abilityId, operation.activationOptionId);',
    '        return nextCharacter.useAbility(source.abilityId, operation.activationOptionId);',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '        return character.useEquipmentAbility(source.itemId, source.abilityId);',
    '        return nextCharacter.useEquipmentAbility(source.itemId, source.abilityId);',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '        return character.useAbility(projectedId, operation.activationOptionId);',
    '        return nextCharacter.useAbility(projectedId, operation.activationOptionId);',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''      return updateRaceAbilityState(\n        character,''',
    '''      return updateRaceAbilityState(\n        operation.type === "character.ability.use" ? nextCharacter : character,''',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    'function updateRaceAbilityState(\n',
    '''function findAbilityForSource(\n  character: CharacterTemplate,\n  source: SessionAbilitySource,\n): Ability | undefined {\n  if (source.type === "race") {\n    return character.get("sheet").race.naturalAbilities?.find((ability) => ability.id === source.abilityId);\n  }\n  if (source.type === "equipment") {\n    return character.getEquipmentAbilities().find((ability) =>\n      ability.sourceItemId === source.itemId && ability.originalAbilityId === source.abilityId\n    );\n  }\n  if (source.type === "condition") {\n    return character.getCharacterAbilities().find((ability) =>\n      ability.source === "condition" &&\n      ability.sourceConditionId === source.conditionId &&\n      ability.originalAbilityId === source.abilityId\n    );\n  }\n  return character.getCharacterAbilities().find((ability) =>\n    ability.id === source.abilityId && ability.source !== "equipment" && ability.source !== "condition"\n  );\n}\n\nfunction updateRaceAbilityState(\n''',
)

print("Ability resource costs and Select overlay patch applied.")
