import { useEffect, useMemo, useState } from "react"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { normalizeInitiativeSession } from "../../../models/initiative/Initiative"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import { DAMAGE_TYPE_OPTIONS, type DamageType } from "../../../models/combat/Damage"
import { ATTRIBUTES } from "../../../contexts/consts"
import type { Attribute } from "../../../models/sheet/Attribute"
import { abilityRequiresWeaponAttributeSelection, getAbilityAttackRiderDamageChoices, optionRequiresWeaponSelection } from "../../../models/combat/AttackRider"
import { getCharacterConditions } from "../../../models/characters/characterConditionStorage"
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
import { isValidBonusRollValue, listBonusRollRequirements } from "../../../models/bonuses/BonusRoll"
import { getAbilitySelfDamageRollRequirements } from "../../../models/abilities/abilitySelfDamage"
import { getAbilityWeaponInfusions } from "../../../models/abilities/abilityActivation"

export function AbilityResourceActivationModal({
  ability,
  character,
  onClose,
  onConfirm,
  forceManualRolls = false,
}: {
  ability: Ability
  character: CharacterTemplate
  onClose: () => void
  onConfirm: (optionId: string | undefined, selection: AbilityResourceSelection | undefined, bonusRollValues?: Record<string, number>, selectedWeaponId?: string, targetRefs?: string[], pointLabel?: string) => void
  forceManualRolls?: boolean
}) {
  const { characters: visibleCharacters } = useCharacterWorkspace()
  const runtime = useOptionalSessionRuntime()
  const targeting = ability.targeting?.mode ?? "none"
  const maxTargets = Math.max(1, Math.min(20, ability.targeting?.maxTargets ?? 1))
  const [targetRefs, setTargetRefs] = useState<string[]>([])
  const [pointLabel, setPointLabel] = useState("")
  const availableTargets = useMemo(() => {
    const result = new Map<string, string>()
    result.set(`character:${character.get("id")}`, `${character.get("name")} (você)`)
    for (const candidate of visibleCharacters) {
      result.set(`character:${candidate.get("id")}`, candidate.get("name"))
    }
    if (runtime?.initiativeState?.initialized) {
      const initiative = normalizeInitiativeSession(runtime.initiativeState.session)
      for (const entry of initiative.entries) {
        if (entry.sourceType === "character" && entry.sourceId) {
          if (!result.has(`character:${entry.sourceId}`)) result.set(`character:${entry.sourceId}`, entry.name)
        } else if (entry.sourceId?.startsWith("compendium:") &&
          runtime.runtimeConfigSnapshot?.config.creatureCompendium.some(creature =>
            creature.id === entry.sourceId!.slice("compendium:".length) && creature.ownerUserId)) {
          const id = entry.sourceId.slice("compendium:".length)
          result.set(`companion:${id}`, entry.name)
        } else {
          result.set(`initiative:${entry.id}`, entry.name)
        }
      }
    }
    for (const creature of runtime?.runtimeConfigSnapshot?.config.creatureCompendium ?? []) {
      if (!creature.ownerUserId) continue
      result.set(`companion:${creature.id}`, `${creature.name} (acompanhante)`)
    }
    return [...result].map(([value, label]) => ({ value, label }))
  }, [character, visibleCharacters, runtime?.initiativeState, runtime?.runtimeConfigSnapshot])
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
  const damageTypeChoices = getAbilityAttackRiderDamageChoices(ability, optionId)
  const [selectedDamageType, setSelectedDamageType] = useState<DamageType | "">("")
  const [selectedWeaponId, setSelectedWeaponId] = useState("")
  const [selectedWeaponAttribute, setSelectedWeaponAttribute] = useState<Attribute | "">("")
  const needsAttribute = abilityRequiresWeaponAttributeSelection(ability, optionId)
  const infusions = getAbilityWeaponInfusions(character, ability.originalAbilityId ?? ability.id)
  const boundWeaponId = ability.allowMultipleWeaponActivations ? undefined : infusions[0]?.weaponId
  const needsWeapon = optionRequiresWeaponSelection(ability, optionId)
  const currentWeaponId = boundWeaponId || selectedWeaponId
  const existingOnWeapon = infusions.find(infusion => infusion.weaponId === currentWeaponId)
  const isDuplicateInfusion = Boolean(needsWeapon && existingOnWeapon &&
    (!ability.allowOptionSwitching || existingOnWeapon.optionId === optionId))
  const effectiveDamageType = damageTypeChoices.includes(selectedDamageType as DamageType) ? selectedDamageType : ""
  const [alternatives, setAlternatives] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (ability.resourceCosts ?? [])
        .filter((group) => group.mode === "oneOf" && group.costs[0])
        .map((group) => [group.id, group.costs[0]!.id]),
    ),
  )
  const bonusRollRequirements = useMemo(
    () => listBonusRollRequirements(ability.bonuses)
      .filter(entry => forceManualRolls || entry.mode === "manual")
      .map(entry => ({ key: entry.key, label: entry.label, dice: entry.dice, formula: entry.formula })),
    [ability.bonuses, forceManualRolls],
  )
  const selfDamageRequirements = getAbilitySelfDamageRollRequirements(ability, optionId)
  const optionBonusRollRequirements = listBonusRollRequirements(ability.activationOptions?.find(option => option.id === optionId)?.bonuses)
    .filter(entry => forceManualRolls || entry.mode === "manual")
    .map(entry => ({ ...entry, key: `option:${optionId}:${entry.key}` }))
  const manualRollRequirements = [
    ...bonusRollRequirements,
    ...optionBonusRollRequirements,
    ...(forceManualRolls ? selfDamageRequirements.map(entry => ({
      key: entry.key, label: entry.label, dice: entry.dice, formula: undefined,
    })) : []),
  ]
  const [manualRollValues, setManualRollValues] = useState<Record<string, string>>({})

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
    if (!(ability.resourceCosts?.length) && !ability.resourceUpcast?.enabled && !effectiveDamageType && !selectedWeaponAttribute) return undefined
    return {
      activationLevel,
      damageType: effectiveDamageType ? effectiveDamageType as DamageType : undefined,
      weaponAttribute: needsAttribute && selectedWeaponAttribute ? selectedWeaponAttribute : undefined,
      alternatives: Object.keys(alternatives).length ? alternatives : undefined,
    }
  }, [ability.resourceCosts?.length, ability.resourceUpcast?.enabled, activationLevel, alternatives, effectiveDamageType, needsAttribute, selectedWeaponAttribute])

  const payment = canPayAbilityResourceCosts(character, ability, selection)
  const optionRequired = (ability.activationOptions?.length ?? 0) > 0
  const manualRollsValid = manualRollRequirements.every((entry) => {
    const raw = manualRollValues[entry.key]?.trim() ?? ""
    if (raw === "" || !Number.isFinite(Number(raw))) return false
    const selfCost = selfDamageRequirements.find(cost => cost.key === entry.key)
    return selfCost
      ? (Number.isInteger(Number(raw)) && Number(raw) >= selfCost.minimum && Number(raw) <= selfCost.maximum)
      : isValidBonusRollValue(entry.dice, Number(raw))
  })
  const targetSelectionValid = targeting === "none" || targeting === "self" || (targetRefs.length > 0 && targetRefs.length <= maxTargets)
  const canConfirm = targetSelectionValid && payment.ok && selfDamageRequirements.every(entry => entry.minimum > 0) && (!optionRequired || Boolean(optionId)) && manualRollsValid && (!damageTypeChoices.length || Boolean(effectiveDamageType)) && (!needsWeapon || Boolean(currentWeaponId)) && !isDuplicateInfusion && (!needsAttribute || Boolean(selectedWeaponAttribute))

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

        {needsWeapon ? <label className="grid gap-1 text-xs text-textMuted">
          <span className="font-semibold text-textH">Arma afetada</span>
          <Select value={boundWeaponId || selectedWeaponId} disabled={Boolean(boundWeaponId)} onChange={event => setSelectedWeaponId(event.target.value)}>
            <option value="">Escolha uma arma equipada</option>
            {character.get("equipment").weapons.map(weapon => {
              const active = infusions.find(infusion => infusion.weaponId === weapon.id)
              return <option key={weapon.id} value={weapon.id}>
                {weapon.name}{active ? " (já infundida)" : ""}
              </option>
            })}
          </Select>
          {isDuplicateInfusion ? <span className="text-xs text-danger">
            Esta arma já tem um rito ativo. Encerre o efeito existente ou escolha outra arma.
          </span> : null}
        </label> : null}

        {needsAttribute ? <label className="grid gap-1 text-xs text-textMuted">
          <span className="font-semibold text-textH">Atributo para os ataques e danos da arma</span>
          <Select value={selectedWeaponAttribute} onChange={event => setSelectedWeaponAttribute(event.target.value as Attribute)}>
            <option value="">Escolha o atributo para esta ativação</option>
            {ATTRIBUTES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <span className="text-[11px]">A escolha permanece enquanto o efeito estiver ativo. Para outra ativação, você poderá selecionar novamente.</span>
        </label> : null}

        {damageTypeChoices.length > 0 ? <label className="grid gap-1 text-xs text-textMuted">
          <span className="font-semibold text-textH">Tipo de dano desta ativação</span>
          <Select value={effectiveDamageType} onChange={event => setSelectedDamageType(event.target.value as DamageType)}>
            <option value="">Escolha o tipo de dano</option>
            {DAMAGE_TYPE_OPTIONS.filter(option => damageTypeChoices.includes(option.value)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </label> : null}

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

        {targeting === "self" ? (
          <div className="rounded-lg border border-border bg-bg-subtle p-3 text-xs text-textH">
            Efeitos automáticos: somente em ${character.get("name")}.
          </div>
        ) : null}
        {(targeting === "targets" || targeting === "point") ? (
          <div className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3">
            <div className="text-xs font-semibold text-textH">
              {targeting === "point" ? "Ponto / área" : "Selecionar alvos"} — máximo {maxTargets}
            </div>
            {targeting === "point" ? (
              <label className="grid gap-1 text-xs text-textMuted">Centro ou referência da área
                <Input value={pointLabel} maxLength={160} placeholder="Ex.: centro da explosão no mapa" onChange={event => setPointLabel(event.target.value)} />
                <span>Raio informado: {ability.targeting?.radiusFeet ?? 10} pés. Selecione os afetados dentro da área.</span>
              </label>
            ) : null}
            <div className="grid max-h-44 gap-2 overflow-y-auto">
              {availableTargets.map(target => (
                <label key={target.value} className="flex items-center gap-2 text-xs text-textH">
                  <input type="checkbox" checked={targetRefs.includes(target.value)}
                    disabled={!targetRefs.includes(target.value) && targetRefs.length >= maxTargets}
                    onChange={event => setTargetRefs(current => event.target.checked
                      ? [...current, target.value].slice(0, maxTargets)
                      : current.filter(value => value !== target.value))} />
                  {target.label}
                </label>
              ))}
              {!availableTargets.length ? <p className="text-xs text-textMuted">Não há alvos disponíveis na sessão.</p> : null}
            </div>
          </div>
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

        {selfDamageRequirements.length > 0 ? (
          <div className="rounded-lg border border-border bg-bg-subtle p-3 text-xs text-textH">
            <div className="font-semibold">Dano próprio na ativação</div>
            {selfDamageRequirements.map(entry => (
              <p key={entry.key} className="mt-1">
                {entry.label}: {entry.dice} ({entry.damageType}). O custo é aplicado diretamente aos PV e não pode ser reduzido.
              </p>
            ))}
            {selfDamageRequirements.some(entry => entry.minimum === 0) ? (
              <p className="mt-1 text-danger">Dado inválido. Use Nd4, Nd6, Nd8, Nd10, Nd12 ou Nd20.</p>
            ) : null}
          </div>
        ) : null}

        {manualRollRequirements.length > 0 ? (
          <div className="grid gap-2 rounded-xl border border-accentBorder bg-accentBg/20 p-3">
            <div>
              <div className="text-xs font-semibold text-textH">
                {forceManualRolls ? "Resultados dos dados físicos" : "Rolagens manuais dos bônus"}
              </div>
              <p className="mt-1 text-[11px] leading-5 text-textMuted">
                {forceManualRolls
                  ? "Role estes dados na mesa e informe apenas o resultado. O sistema não fará RNG digital."
                  : "Informe apenas o resultado dos dados. O bônus por fórmula é calculado e somado automaticamente."}
              </p>
            </div>
            {manualRollRequirements.map((entry) => (
              <label key={entry.key} className="grid gap-1">
                <span className="text-xs font-medium text-textH">{entry.label}</span>
                <span className="text-[10px] text-textMuted">Role {entry.dice}{entry.formula?.trim() ? " + fórmula" : ""}.</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={manualRollValues[entry.key] ?? ""}
                  placeholder="Resultado dos dados"
                  onChange={(event) => setManualRollValues((current) => ({
                    ...current,
                    [entry.key]: event.target.value,
                  }))}
                />
              </label>
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
            onClick={() => onConfirm(
              optionId || undefined,
              selection,
              manualRollRequirements.length
                ? Object.fromEntries(
                    manualRollRequirements.map((entry) => [entry.key, Number(manualRollValues[entry.key])]),
                  )
                : undefined,
              boundWeaponId || selectedWeaponId || undefined,
              targeting === "self" ? [`character:${character.get("id")}`] : targeting === "none" ? undefined : targetRefs,
              targeting === "point" ? pointLabel : undefined,
            )}
          >
            Usar habilidade
          </Button>
        </div>
      </div>
    </Modal>
  )
}
