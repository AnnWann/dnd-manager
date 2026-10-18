import { SpellCastChoiceField } from "../../../../packages/game-ui/src/CastActivationFields"
import { SpellListBoard } from "../../../../packages/game-ui/src/SpellListBoard"
import { ResourcePill } from "../../../../packages/game-ui/src/ResourcePill"
import { Select as SharedSelect } from "../../../components/ui/Select"
import { DAMAGE_TYPE_OPTIONS, type DamageType } from "../../../models/combat/Damage"
import { getAttackRiderDamageChoices } from "../../../models/combat/AttackRider"
import { useMemo, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { CLASS_NAMES } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import { cn } from "../../../lib/cn"
import { getRollVisibility, rollModeFromEvent, rollModifierHint } from "../../../lib/diceRoller"
import { getAbilityUsageMax } from "../../../models/abilities/abilityActivation"
import { getCharacterGrantedSpells, spendGrantedEquipmentSpellUse, spendGrantedSpellAbilityUse, type CharacterGrantedEquipmentSpellUsageSource, type CharacterGrantedSpellUsageSource } from "../../../models/characters/characterGrantedSpells"
import { consumeCharacterScroll } from "../../../models/characters/characterScrolls"
import { beginSpellConcentration, getConcentrationCondition } from "../../../models/characters/characterConcentration"
import { getChannelDivinityPool, restoreChannelDivinity, spendChannelDivinity } from "../../../models/characters/characterChannelDivinity"
import { getKiPool, restoreKi, spendKi } from "../../../models/characters/characterKi"
import { getSorceryPoints, restorePactSlot, restoreSorceryPoint, restoreSpellSlot, spendPactSlot, spendSorceryPoint, spendSpellSlot } from "../../../models/characters/characterMagic"
import {
  getCustomSpellSlotPools,
  restoreCustomSpellSlot,
  spendCustomSpellSlot,
} from "../../../models/characters/customClassConfig"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell, SpellResourceCost, SpellResourceType } from "../../../models/magic/spells/Spell"
import { getSpellCastDamageChoices, getSpellOnCastAttackRiders } from "../../../models/magic/spells/spellAttackRiders"
import { canPaySpellResourceCost, getEffectiveSpellResourceOptions, spellResourceLabel, spendSpellResourceCost } from "../../../models/magic/spells/spellResourceCost"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"
import type { CharacterClassInterface } from "../../../models/sheet/Class"
import type { SessionDiceRollMode } from "../../../shared/session-runtime/diceRollProtocol"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import type { SessionSpellCastPayment } from "../../session-runtime/magicSessionProtocol"

type ActionFilter = "action" | "bonusAction" | "reaction" | "other"
type CastingResource = "slot" | "ability" | SpellResourceType
type Props = { character: CharacterTemplate; updateCharacter: (characterId: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void; scrollOnlyItemId?: string }
type MinimalSpellEntry = { key: string; spell: Spell; source: SpellSource; sourceCastingMode: "slots" | "source"; sourceUsageRemaining?: number; sourceUsageMaximum?: number; sourceUsageLabel?: string; sourceUsageSource?: CharacterGrantedSpellUsageSource; sourceEquipmentSpellUsageSource?: CharacterGrantedEquipmentSpellUsageSource; sourceResourceCost?: SpellResourceCost; scrollItemId?: string }
type SlotChoice = { level: MagicCircleLevel; pool: "normal" | "pact" }
const ACTION_FILTERS: Array<{ value: ActionFilter; label: string }> = [{ value: "action", label: "Ação" }, { value: "bonusAction", label: "Ação bônus" }, { value: "reaction", label: "Reação" }, { value: "other", label: "Outras" }]

export function MinimalMagicActions({ character, updateCharacter, scrollOnlyItemId }: Props) {
  const { getSpellByIndex } = useMagicContext()
  const sessionRuntime = useOptionalSessionRuntime()
  const [actionFilter, setActionFilter] = useState<ActionFilter>("action")
  const [levelFilter, setLevelFilter] = useState<number | "all">("all")
  const [selected, setSelected] = useState<MinimalSpellEntry | null>(null)
  const [targetEntryId, setTargetEntryId] = useState("")
  const [selectedDamageType, setSelectedDamageType] = useState<DamageType | "">("")
  const [selectedWeaponId, setSelectedWeaponId] = useState("")
  const [castLevel, setCastLevel] = useState<number | null>(null)
  const [castingResource, setCastingResource] = useState<CastingResource>("slot")
  const [confirmConcentrationReplacement, setConfirmConcentrationReplacement] = useState(false)
  const [pendingRollMode, setPendingRollMode] = useState<SessionDiceRollMode>("normal")
  const [error, setError] = useState("")
  const allSpells = useMemo(() => buildAvailableSpells(character, getSpellByIndex).filter(entry => !scrollOnlyItemId || entry.scrollItemId === scrollOnlyItemId), [character, getSpellByIndex, scrollOnlyItemId])
  const availableLevels = useMemo(() => Array.from(new Set(allSpells.map((entry) => entry.spell.slotLevel))).sort((a, b) => a - b), [allSpells])
  const visibleSpells = allSpells.filter((entry) => normalizeCastingTime(entry.spell) === actionFilter).filter((entry) => levelFilter === "all" || entry.spell.slotLevel === levelFilter).sort((a, b) => a.spell.slotLevel - b.spell.slotLevel || spellName(a.spell).localeCompare(spellName(b.spell), "pt-BR"))
  const slots = character.getSpellSlots(), pactSlots = character.getPactSlots(), sorceryPoints = getSorceryPoints(character), channelDivinity = getChannelDivinityPool(character), ki = getKiPool(character)
  const customSlotPools = getCustomSpellSlotPools(character)
  const hasMagicResources = Object.values(slots).some((slot) => Boolean(slot && slot.max > 0)) || Boolean(pactSlots?.max) || sorceryPoints.max > 0 || Boolean(channelDivinity?.max) || Boolean(ki?.max) || customSlotPools.length > 0 || allSpells.some((entry) => entry.sourceUsageMaximum !== undefined)
  if (!allSpells.length && !hasMagicResources) return null

  const currentConcentration = getConcentrationCondition(character)
  const slotChoices = selected ? getSlotChoices(character, selected.spell) : []
  const globalOptions = selected ? getEffectiveSpellResourceOptions(character, selected.spell) : { useSlots: true, resources: [] }
  const resourceChoices = selected ? getResourceChoices(character, selected, slotChoices) : []
  const selectedBaseCost = selected?.sourceResourceCost?.resource === castingResource
    ? selected.sourceResourceCost
    : globalOptions.resources.find((cost) => cost.resource === castingResource)
  const selectedCost = selected && selectedBaseCost ? getUpcastResourceCost(selected.spell, selectedBaseCost, castLevel) : undefined
  const asksCastLevel = Boolean(selected && selected.spell.slotLevel > 0 && (castingResource === "slot" || selectedBaseCost))

  function openSpell(entry: MinimalSpellEntry) {
    setSelectedDamageType(""); setSelectedWeaponId(""); setTargetEntryId(""); setSelected(entry); setError(""); setConfirmConcentrationReplacement(false); setCastLevel(entry.spell.slotLevel)
    if (entry.sourceResourceCost) return setCastingResource(entry.sourceResourceCost.resource)
    if (entry.sourceCastingMode === "source" && (entry.sourceUsageSource || entry.sourceEquipmentSpellUsageSource || entry.scrollItemId)) return setCastingResource("ability")
    const choices = getSlotChoices(character, entry.spell)
    if (entry.sourceCastingMode === "slots" && globalPayment(entry).useSlots && (entry.spell.slotLevel === 0 || choices.length)) {
      setCastLevel(choices[0]?.level ?? entry.spell.slotLevel); return setCastingResource("slot")
    }
    const cost = globalPayment(entry).resources.find((candidate) => canPaySpellResourceCost(character, candidate)) ?? globalPayment(entry).resources[0]
    setCastingResource(cost?.resource ?? "slot")
  }

  function globalPayment(entry: MinimalSpellEntry) { return getEffectiveSpellResourceOptions(character, entry.spell) }
  function changeCastingResource(value: CastingResource) { setCastingResource(value); if (selected) setCastLevel(value === "slot" ? getSlotChoices(character, selected.spell)[0]?.level ?? selected.spell.slotLevel : selected.spell.slotLevel) }
  function castSelected(mode: SessionDiceRollMode) {
    if (!selected) return
    setPendingRollMode(mode)
    if (selected.spell.concentration && currentConcentration) {
      setConfirmConcentrationReplacement(true)
      return
    }
    executeSelectedCast(mode)
  }
  function finishCast() { setConfirmConcentrationReplacement(false); setSelected(null) }

  function executeSelectedCast(mode: SessionDiceRollMode = pendingRollMode) {
    if (!selected) return
    const spell = selected.spell
    const typeChoices = getSpellCastDamageChoices(spell)
    if (typeChoices.length && !typeChoices.includes(selectedDamageType as DamageType)) {
      setError("Escolha o tipo de dano permitido para esta conjuração.")
      return
    }

    if (sessionRuntime) {
      if (sessionRuntime.status !== "connected") {
        setError("A sessão está desconectada. Não foi possível conjurar a magia.")
        return
      }

      if (getSpellOnCastAttackRiders(spell).some(rider => rider.targetSelection === "onCast") && !targetEntryId) {
        setError("Selecione o alvo marcado por esta magia.")
        return
      }
      const resolved = resolveAuthoritativeCastPayment()
      if (!resolved) return
      const sent = sessionRuntime.dispatchMagicOperation({
        type: "character.spell.cast",
        characterId: character.get("id"),
        requestId: crypto.randomUUID(),
        spellIndex: spell.index,
        sourceId: selected.source.sourceId,
        castLevel: resolved.castLevel,
        mode,
        visibility: getRollVisibility(),
        payment: resolved.payment,
        targetEntryId: targetEntryId || undefined,
        selectedDamageType: selectedDamageType || undefined,
        selectedWeaponId: selectedWeaponId || undefined,
      })
      if (!sent) {
        setError("Não foi possível enviar a conjuração para a sessão.")
        return
      }
      finishCast()
      return
    }
    if (castingResource === "ability") {
      if (selected.scrollItemId) {
        updateCharacter(character.get("id"), current => {
          const next = consumeCharacterScroll(current, selected.scrollItemId!, spell.index)
          return spell.concentration && next !== current ? beginSpellConcentration(next, spell) : next
        })
        finishCast()
        return
      }
      if ((selected.sourceUsageRemaining ?? 0) <= 0 && (selected.sourceUsageSource || selected.sourceEquipmentSpellUsageSource)) {
        setError("Não há cargas disponíveis para esta magia.")
        return
      }
      updateCharacter(character.get("id"), (current) => {
        let next = selected.sourceEquipmentSpellUsageSource
          ? spendGrantedEquipmentSpellUse(current, selected.sourceEquipmentSpellUsageSource)
          : selected.sourceUsageSource
            ? spendGrantedSpellAbilityUse(current, selected.sourceUsageSource)
            : current
        if (spell.concentration) next = beginSpellConcentration(next, spell)
        return next
      })
      finishCast()
      return
    }
    if (castingResource !== "slot") {
      const baseCost = selected.sourceResourceCost?.resource === castingResource ? selected.sourceResourceCost : globalOptions.resources.find((candidate) => candidate.resource === castingResource)
      const cost = baseCost ? getUpcastResourceCost(spell, baseCost, castLevel) : undefined
      if (!cost || !canPaySpellResourceCost(character, cost)) { setError(`Não há ${cost ? spellResourceLabel(cost.resource) : "recurso"} suficiente.`); return }
      updateCharacter(character.get("id"), (current) => { let next = spendSpellResourceCost(current, cost); if (spell.concentration) next = beginSpellConcentration(next, spell); return next })
      finishCast()
      return
    }
    if (selected.sourceCastingMode !== "slots" || !globalOptions.useSlots) { setError("Esta magia não usa espaços de magia."); return }
    if (spell.slotLevel === 0) {
      if (spell.concentration) updateCharacter(character.get("id"), (current) => beginSpellConcentration(current, spell))
      finishCast()
      return
    }
    const choices = getSlotChoices(character, spell)
    const level = asksCastLevel ? castLevel : choices[0]?.level
    const sameLevel = choices.filter((choice) => choice.level === level)
    const choice = sameLevel.find((entry) => entry.pool === "normal") ?? sameLevel[0] ?? choices[0]
    if (!choice) { setError("Nenhum espaço compatível disponível."); return }
    updateCharacter(character.get("id"), (current) => { let next = choice.pool === "pact" ? current.spendPactSlot() : current.spendSpellSlot(choice.level); if (spell.concentration) next = beginSpellConcentration(next, spell); return next })
    finishCast()
  }

  function resolveAuthoritativeCastPayment(): {
    castLevel: number
    payment: SessionSpellCastPayment
  } | null {
    if (!selected) return null
    const spell = selected.spell

    if (castingResource === "ability") {
      if (selected.scrollItemId) {
        return { castLevel: spell.slotLevel, payment: { type: "scroll", itemId: selected.scrollItemId } }
      }
      if (selected.sourceEquipmentSpellUsageSource) {
        if ((selected.sourceUsageRemaining ?? 0) <= 0) {
          setError("Não há cargas disponíveis neste item.")
          return null
        }
        return {
          castLevel: spell.slotLevel,
          payment: {
            type: "equipment-spell-use",
            source: selected.sourceEquipmentSpellUsageSource,
          },
        }
      }
      if (selected.sourceUsageSource) {
        if ((selected.sourceUsageRemaining ?? 0) <= 0) {
          setError("Não há cargas disponíveis nesta habilidade.")
          return null
        }
        return {
          castLevel: spell.slotLevel,
          payment: { type: "ability-use", source: selected.sourceUsageSource },
        }
      }
      if (selected.sourceCastingMode === "source" && !selected.sourceResourceCost) {
        return { castLevel: spell.slotLevel, payment: { type: "none" } }
      }
      setError("Não foi possível determinar o recurso desta magia.")
      return null
    }

    if (castingResource !== "slot") {
      const baseCost = selected.sourceResourceCost?.resource === castingResource
        ? selected.sourceResourceCost
        : globalOptions.resources.find((candidate) => candidate.resource === castingResource)
      if (!baseCost) {
        setError("O recurso selecionado não pode pagar esta magia.")
        return null
      }
      return {
        castLevel: Math.max(spell.slotLevel, Math.trunc(castLevel ?? spell.slotLevel)),
        payment: { type: "resource", resource: castingResource },
      }
    }

    if (spell.slotLevel === 0) {
      return { castLevel: 0, payment: { type: "none" } }
    }
    if (selected.sourceCastingMode !== "slots" || !globalOptions.useSlots) {
      setError("Esta magia não usa espaços de magia.")
      return null
    }

    const choices = getSlotChoices(character, spell)
    const level = asksCastLevel ? castLevel : choices[0]?.level
    const sameLevel = choices.filter((choice) => choice.level === level)
    const choice = sameLevel.find((entry) => entry.pool === "normal") ?? sameLevel[0] ?? choices[0]
    if (!choice) {
      setError("Nenhum espaço compatível disponível.")
      return null
    }
    return {
      castLevel: choice.level,
      payment: { type: "slot", pool: choice.pool, level: choice.level },
    }
  }

  const useDisabled = selected ? castingResource === "ability" ? (selected.scrollItemId ? false : (selected.sourceUsageSource || selected.sourceEquipmentSpellUsageSource) ? (selected.sourceUsageRemaining ?? 0) <= 0 : !(selected.sourceCastingMode === "source" && !selected.sourceResourceCost)) : castingResource === "slot" ? selected.sourceCastingMode !== "slots" || !globalOptions.useSlots || (selected.spell.slotLevel > 0 && slotChoices.length === 0) : !selectedCost || !canPaySpellResourceCost(character, selectedCost) : true

  return <section className={scrollOnlyItemId ? "mt-2" : "rounded-xl border border-border bg-bg p-3 shadow-theme-sm"}>
    {allSpells.length && scrollOnlyItemId ? <Button size="sm" variant="secondary" onClick={() => openSpell(allSpells[0])}>Conjurar pergaminho</Button> : null}
    {allSpells.length && !scrollOnlyItemId ? (
      <SpellListBoard
        entries={visibleSpells.map(entry => ({
          key: entry.key,
          name: spellName(entry.spell),
          level: entry.spell.slotLevel,
          source: sourceLabel(entry.source),
          cost: entry.sourceResourceCost
            ? `${entry.sourceResourceCost.amount} ${spellResourceLabel(entry.sourceResourceCost.resource)}`
            : undefined,
          original: entry,
        }))}
        filters={ACTION_FILTERS}
        selectedFilter={actionFilter}
        onFilterChange={value => setActionFilter(value as ActionFilter)}
        availableLevels={availableLevels}
        levelFilter={levelFilter}
        onLevelChange={setLevelFilter}
        onSelect={entry => openSpell(entry.original)}
      />
    ) : null}

    {hasMagicResources && !scrollOnlyItemId ? <div className="mt-4 border-t border-border pt-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Recursos mágicos</div><div className="mt-2 flex flex-wrap gap-2">
      {Object.entries(slots).map(([level, slot]) => slot && slot.max > 0 ? <ResourcePill key={level} label={`N${level}`} current={slot.current} max={slot.max} onDecrease={() => updateCharacter(character.get("id"), (current) => spendSpellSlot(current, Number(level) as MagicCircleLevel))} onIncrease={() => updateCharacter(character.get("id"), (current) => restoreSpellSlot(current, Number(level) as MagicCircleLevel))} /> : null)}
      {pactSlots?.max ? <ResourcePill label={`Pacto N${pactSlots.level}`} current={pactSlots.current} max={pactSlots.max} onDecrease={() => updateCharacter(character.get("id"), spendPactSlot)} onIncrease={() => updateCharacter(character.get("id"), restorePactSlot)} /> : null}
      {customSlotPools.flatMap((pool) => Object.values(pool.slots).map((slot) => <ResourcePill key={`${pool.id}:${slot.level}`} label={`${pool.name} N${slot.level}`} current={slot.current} max={slot.max} onDecrease={() => updateCharacter(character.get("id"), (current) => spendCustomSpellSlot(current, pool.id, slot.level))} onIncrease={() => updateCharacter(character.get("id"), (current) => restoreCustomSpellSlot(current, pool.id, slot.level))} />))}
      {sorceryPoints.max > 0 ? <ResourcePill label="Pontos de magia" current={sorceryPoints.current} max={sorceryPoints.max} onDecrease={() => updateCharacter(character.get("id"), spendSorceryPoint)} onIncrease={() => updateCharacter(character.get("id"), restoreSorceryPoint)} /> : null}
      {channelDivinity ? <ResourcePill label="Canalizar Divindade" current={channelDivinity.current} max={channelDivinity.max} onDecrease={() => updateCharacter(character.get("id"), spendChannelDivinity)} onIncrease={() => updateCharacter(character.get("id"), restoreChannelDivinity)} /> : null}
      {ki ? <ResourcePill label="Ki" current={ki.current} max={ki.max} onDecrease={() => updateCharacter(character.get("id"), spendKi)} onIncrease={() => updateCharacter(character.get("id"), restoreKi)} /> : null}
    </div></div> : null}

    {selected ? <Modal title={spellName(selected.spell)} onClose={() => setSelected(null)} className="max-w-xl"><div className="grid gap-3"><div className="text-xs text-textMuted">{sourceLabel(selected.source)}{selected.spell.concentration ? " • Concentração" : ""}</div><p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-text">{selected.spell.description}</p>{resourceChoices.length > 1 ? <SpellCastChoiceField label="Recurso" value={castingResource} options={resourceChoices} onChange={changeCastingResource} /> : null}{asksCastLevel ? <SpellCastChoiceField label="Nível de conjuração" value={castLevel ?? selected.spell.slotLevel} onChange={setCastLevel} options={getCastLevels(selected.spell, castingResource, slotChoices).map(level => ({value: level, label: `Nível ${level}${selectedBaseCost ? ` — ${getUpcastResourceCost(selected.spell, selectedBaseCost, level).amount} ${spellResourceLabel(selectedBaseCost.resource)}` : ""}`}))} /> : null}{(getSpellOnCastAttackRiders(selected.spell).some(rider => rider.targetSelection === "onCast") || selected.spell.targeting?.hasAttackRoll) && sessionRuntime ? <label className="grid gap-1 text-xs text-textMuted">Alvo marcado<SharedSelect className="h-9 rounded-lg border border-border bg-bg px-2 text-textH" value={targetEntryId} onChange={event => setTargetEntryId(event.target.value)}><option value="">Selecione um combatente</option>{(sessionRuntime.initiativeState?.session?.entries ?? []).map(entry => <option key={entry.id} value={entry.id}>{entry.customName || entry.name}</option>)}</SharedSelect></label> : null}{getSpellCastDamageChoices(selected.spell).length > 0 ? <label className="grid gap-1 text-xs text-textMuted">Tipo de dano da conjuração
  <SharedSelect className="h-9 rounded-lg border border-border bg-bg px-2 text-textH" value={selectedDamageType} onChange={event => setSelectedDamageType(event.target.value as DamageType)}>
    <option value="">Escolha o tipo de dano</option>
    {DAMAGE_TYPE_OPTIONS.filter(option => getSpellCastDamageChoices(selected.spell).includes(option.value)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </SharedSelect>
</label> : null}
{getSpellOnCastAttackRiders(selected.spell).some(rider => rider.weaponSelection === "onActivation") ? <label className="grid gap-1 text-xs text-textMuted">Arma afetada pela magia
  <SharedSelect className="h-9 rounded-lg border border-border bg-bg px-2 text-textH" value={selectedWeaponId} onChange={event => setSelectedWeaponId(event.target.value)}>
    <option value="">Escolha uma arma equipada</option>
    {character.get("equipment").weapons.map(weapon => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
  </SharedSelect>
</label> : null}
{error ? <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{error}</div> : null}{confirmConcentrationReplacement ? <div className="rounded-lg border border-warning bg-bg-subtle p-3 text-xs text-text"><p>O personagem já está concentrando. Usar esta magia encerra a concentração atual.</p><div className="mt-2 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmConcentrationReplacement(false)}>Cancelar</Button><Button variant="primary" onClick={() => executeSelectedCast(pendingRollMode)}>Substituir e usar</Button></div></div> : <div className="flex justify-end border-t border-border pt-3">
  <Button
    variant="primary"
    disabled={useDisabled || Boolean(selected && getSpellCastDamageChoices(selected.spell).length && !getSpellCastDamageChoices(selected.spell).includes(selectedDamageType as DamageType)) || Boolean(sessionRuntime && selected && getSpellOnCastAttackRiders(selected.spell).some(rider => rider.targetSelection === "onCast") && !targetEntryId)}
    title={rollModifierHint()}
    onClick={(event) => castSelected(rollModeFromEvent(event.nativeEvent))}
  >
    Usar
  </Button>
</div>}</div></Modal> : null}
  </section>
}

function getUpcastResourceCost(spell: Spell, baseCost: SpellResourceCost, castLevel: number | null): SpellResourceCost { const level = Math.max(spell.slotLevel, Math.min(9, Math.trunc(castLevel ?? spell.slotLevel))); return { ...baseCost, amount: baseCost.amount + Math.max(0, level - spell.slotLevel) } }
function getResourceChoices(character: CharacterTemplate, entry: MinimalSpellEntry, slotChoices: SlotChoice[]) { if (entry.scrollItemId) return [{ value: "ability" as CastingResource, label: "Consumir pergaminho (1 uso)", disabled: false }]; if (entry.sourceResourceCost) return [{ value: entry.sourceResourceCost.resource as CastingResource, label: `${entry.sourceResourceCost.amount} ${spellResourceLabel(entry.sourceResourceCost.resource)}`, disabled: !canPaySpellResourceCost(character, entry.sourceResourceCost) }]; if (entry.sourceCastingMode === "source") { const hasUsage = Boolean(entry.sourceUsageSource || entry.sourceEquipmentSpellUsageSource || entry.scrollItemId); return [{ value: "ability" as CastingResource, label: hasUsage ? `${entry.sourceUsageLabel || sourceLabel(entry.source)} — ${entry.sourceUsageRemaining ?? 0}/${entry.sourceUsageMaximum ?? 0} usos` : `${sourceLabel(entry.source)} — sem custo`, disabled: hasUsage ? (entry.sourceUsageRemaining ?? 0) <= 0 : false }] }; const list: Array<{ value: CastingResource; label: string; disabled: boolean }> = []; const payment = getEffectiveSpellResourceOptions(character, entry.spell); if (payment.useSlots) list.push({ value: "slot", label: "Espaço de magia", disabled: entry.spell.slotLevel > 0 && !slotChoices.length }); for (const cost of payment.resources) list.push({ value: cost.resource, label: `${cost.amount} ${spellResourceLabel(cost.resource)}`, disabled: !canPaySpellResourceCost(character, cost) }); return list }
function buildAvailableSpells(character: CharacterTemplate, getSpellByIndex: (index: string) => Spell | undefined): MinimalSpellEntry[] { const classes = character.get("sheet").classes ?? [], entries: MinimalSpellEntry[] = []; for (const known of character.get("magic")?.spells.knownSpells ?? []) { const spell = getSpellByIndex(known.spells.id); if (!spell) continue; const alwaysAvailable = isAlwaysAvailableSpell(spell, known.source, classes); if (!alwaysAvailable && !known.spells.prepared) continue; entries.push({ key: `known:${known.source.type}:${known.source.sourceId}:${spell.index}`, spell, source: known.source, sourceCastingMode: "slots" }) } for (const grant of getCharacterGrantedSpells(character)) { const spell = getSpellByIndex(grant.index); if (!spell) continue; const maximum = grant.usage ? getAbilityUsageMax(character, grant.usage) : undefined, remaining = grant.usage && maximum !== undefined ? Math.max(0, maximum - grant.usage.used) : undefined; entries.push({ key: grant.key, spell, source: grant.source, sourceCastingMode: grant.resourceCost ? "source" : grant.castingMode === "known" ? "slots" : "source", sourceUsageRemaining: remaining, sourceUsageMaximum: maximum, sourceUsageLabel: grant.usageSource || grant.equipmentSpellUsageSource ? grant.source.name || "Carga da fonte" : undefined, sourceUsageSource: grant.usageSource, sourceEquipmentSpellUsageSource: grant.equipmentSpellUsageSource, sourceResourceCost: grant.resourceCost, scrollItemId: grant.scrollItemId }) } return entries }
function getCastLevels(spell: Spell, resource: CastingResource, slots: SlotChoice[]): number[] { if (resource === "slot") return Array.from(new Set(slots.map((choice) => choice.level))); return Array.from({ length: Math.max(1, 10 - spell.slotLevel) }, (_, index) => spell.slotLevel + index).filter((level) => level >= 1 && level <= 9) }
function isAlwaysAvailableSpell(spell: Spell, source: SpellSource, classes: CharacterClassInterface[]): boolean { if (spell.slotLevel === 0 || source.type !== "class") return true; const data = classes.find((entry) => entry.className === source.name); return !data?.knownSpells || data.knownSpells.mode === "limited" }
function normalizeCastingTime(spell: Spell): ActionFilter { return spell.castingTime.type === "bonusAction" ? "bonusAction" : spell.castingTime.type === "reaction" ? "reaction" : spell.castingTime.type === "action" ? "action" : "other" }
function getSlotChoices(character: CharacterTemplate, spell: Spell): SlotChoice[] { if (spell.slotLevel <= 0) return []; const choices: SlotChoice[] = []; for (const [text, slot] of Object.entries(character.getSpellSlots())) { const level = Number(text) as MagicCircleLevel; if (slot && slot.current > 0 && level >= spell.slotLevel) choices.push({ level, pool: "normal" }) } const pact = character.getPactSlots(); if (pact && pact.current > 0 && pact.level >= spell.slotLevel) choices.push({ level: pact.level as MagicCircleLevel, pool: "pact" }); return choices.sort((a, b) => a.level - b.level) }
function spellName(spell: Spell) { return spell.displayName || spell.name }
function sourceLabel(source: SpellSource) { if (source.type === "class") return CLASS_NAMES[source.name as keyof typeof CLASS_NAMES] ?? source.name ?? "Classe"; return source.name || "Habilidade" }