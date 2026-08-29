import { useEffect, useMemo, useState } from "react"

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
  resolveAbilityResourceCostPreview,
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
  const pactLevel = character.getPactSlots()?.level
  const defaultUsesPact = (ability.resourceCosts ?? []).some((group) =>
    group.mode === "all"
      ? group.costs.some((cost) => cost.kind === "pactSlot")
      : group.costs[0]?.kind === "pactSlot",
  )
  const [activationLevel, setActivationLevel] = useState(() =>
    ability.resourceUpcast?.enabled && defaultUsesPact && pactLevel &&
    pactLevel >= (baseLevel ?? 1) && pactLevel <= (maximumLevel ?? 9)
      ? pactLevel
      : baseLevel,
  )
  const [optionId, setOptionId] = useState(ability.activationOptions?.[0]?.id ?? "")
  const [alternatives, setAlternatives] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (ability.resourceCosts ?? [])
        .filter((group) => group.mode === "oneOf" && group.costs[0])
        .map((group) => [group.id, group.costs[0]!.id]),
    ),
  )

  const selectedUsesPact = useMemo(() =>
    (ability.resourceCosts ?? []).some((group) => {
      if (group.mode === "all") return group.costs.some((cost) => cost.kind === "pactSlot")
      const selectedId = alternatives[group.id] ?? group.costs[0]?.id
      return group.costs.find((cost) => cost.id === selectedId)?.kind === "pactSlot"
    }),
  [ability.resourceCosts, alternatives])

  useEffect(() => {
    if (!ability.resourceUpcast?.enabled || !selectedUsesPact || !pactLevel) return
    if (pactLevel < (baseLevel ?? 1) || pactLevel > (maximumLevel ?? 9)) return
    setActivationLevel(pactLevel)
  }, [ability.resourceUpcast?.enabled, baseLevel, maximumLevel, pactLevel, selectedUsesPact])

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
          selectedUsesPact && pactLevel ? (
            <div className="grid gap-1 rounded-lg border border-border bg-bg-subtle p-3">
              <span className="text-xs font-semibold text-textH">Nível de ativação</span>
              <span className="text-sm text-textH">Nível {pactLevel} — espaço de pacto atual</span>
              <span className="text-[11px] leading-5 text-textMuted">
                Espaços de pacto são sempre usados no nível atual do pacto; não há um slot de pacto inferior para escolher.
              </span>
            </div>
          ) : (
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-textH">Nível de ativação</span>
              <Select value={String(activationLevel ?? baseLevel)} onChange={(event) => setActivationLevel(Number(event.target.value))}>
                {Array.from({ length: maximumLevel - baseLevel + 1 }, (_, index) => baseLevel + index).map((level) => (
                  <option key={level} value={level}>Nível {level}{level === baseLevel ? " — base" : " — upcast"}</option>
                ))}
              </Select>
            </label>
          )
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
                    onChange={(event) => {
                      const cost = group.costs.find((entry) => entry.id === event.target.value)
                      setAlternatives((current) => ({ ...current, [group.id]: event.target.value }))
                      if (cost?.kind === "pactSlot" && ability.resourceUpcast?.enabled) {
                        const pactLevel = character.getPactSlots()?.level
                        if (pactLevel && pactLevel >= (baseLevel ?? 1) && pactLevel <= (maximumLevel ?? 9)) setActivationLevel(pactLevel)
                      }
                    }}
                  >
                    {group.costs.map((cost) => {
                      const preview = resolveAbilityResourceCostPreview(ability, cost, selection)
                      return <option key={cost.id} value={cost.id}>{abilityResourceCostLabel(cost, preview)}</option>
                    })}
                  </Select>
                ) : (
                  <div className="mt-2 grid gap-1 text-xs text-textH">
                    {group.costs.map((cost) => {
                      const preview = resolveAbilityResourceCostPreview(ability, cost, selection)
                      return <div key={cost.id}>• {abilityResourceCostLabel(cost, preview)}</div>
                    })}
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
