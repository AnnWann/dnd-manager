import { Button } from "../../../components/ui/Button"
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
