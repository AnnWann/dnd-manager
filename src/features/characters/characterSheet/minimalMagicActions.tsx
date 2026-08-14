import { useMemo, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { CLASS_NAMES } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import { cn } from "../../../lib/cn"
import { getAbilityUsageMax } from "../../../models/abilities/abilityActivation"
import { getCharacterGrantedSpells, spendGrantedSpellAbilityUse, type CharacterGrantedSpellUsageSource } from "../../../models/characters/characterGrantedSpells"
import { beginSpellConcentration, getConcentrationCondition } from "../../../models/characters/characterConcentration"
import { getChannelDivinityPool, restoreChannelDivinity, spendChannelDivinity } from "../../../models/characters/characterChannelDivinity"
import { getKiPool, restoreKi, spendKi } from "../../../models/characters/characterKi"
import { getSorceryPoints, restorePactSlot, restoreSorceryPoint, restoreSpellSlot, spendPactSlot, spendSorceryPoint, spendSpellSlot } from "../../../models/characters/characterMagic"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell, SpellResourceCost, SpellResourceType } from "../../../models/magic/spells/Spell"
import { canPaySpellResourceCost, getEffectiveSpellResourceOptions, spellResourceLabel, spendSpellResourceCost } from "../../../models/magic/spells/spellResourceCost"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"
import type { CharacterClassInterface } from "../../../models/sheet/Class"

type ActionFilter = "action" | "bonusAction" | "reaction" | "other"
type CastingResource = "slot" | "ability" | SpellResourceType
type Props = { character: CharacterTemplate; updateCharacter: (characterId: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void }
type MinimalSpellEntry = { key: string; spell: Spell; source: SpellSource; sourceCastingMode: "slots" | "source"; sourceUsageRemaining?: number; sourceUsageMaximum?: number; sourceUsageLabel?: string; sourceUsageSource?: CharacterGrantedSpellUsageSource; sourceResourceCost?: SpellResourceCost }
type SlotChoice = { level: MagicCircleLevel; pool: "normal" | "pact" }
const ACTION_FILTERS: Array<{ value: ActionFilter; label: string }> = [{ value: "action", label: "Ação" }, { value: "bonusAction", label: "Ação bônus" }, { value: "reaction", label: "Reação" }, { value: "other", label: "Outras" }]

export function MinimalMagicActions({ character, updateCharacter }: Props) {
  const { getSpellByIndex } = useMagicContext()
  const [actionFilter, setActionFilter] = useState<ActionFilter>("action")
  const [levelFilter, setLevelFilter] = useState<number | "all">("all")
  const [selected, setSelected] = useState<MinimalSpellEntry | null>(null)
  const [castLevel, setCastLevel] = useState<number | null>(null)
  const [castingResource, setCastingResource] = useState<CastingResource>("slot")
  const [confirmConcentrationReplacement, setConfirmConcentrationReplacement] = useState(false)
  const [error, setError] = useState("")
  const allSpells = useMemo(() => buildAvailableSpells(character, getSpellByIndex), [character, getSpellByIndex])
  const availableLevels = useMemo(() => Array.from(new Set(allSpells.map((entry) => entry.spell.slotLevel))).sort((a, b) => a - b), [allSpells])
  const visibleSpells = allSpells.filter((entry) => normalizeCastingTime(entry.spell) === actionFilter).filter((entry) => levelFilter === "all" || entry.spell.slotLevel === levelFilter).sort((a, b) => a.spell.slotLevel - b.spell.slotLevel || spellName(a.spell).localeCompare(spellName(b.spell), "pt-BR"))
  const slots = character.getSpellSlots(), pactSlots = character.getPactSlots(), sorceryPoints = getSorceryPoints(character), channelDivinity = getChannelDivinityPool(character), ki = getKiPool(character)
  const hasMagicResources = Object.values(slots).some((slot) => Boolean(slot && slot.max > 0)) || Boolean(pactSlots?.max) || sorceryPoints.max > 0 || Boolean(channelDivinity?.max) || Boolean(ki?.max) || allSpells.some((entry) => entry.sourceUsageMaximum !== undefined)
  if (!allSpells.length && !hasMagicResources) return null

  const currentConcentration = getConcentrationCondition(character)
  const slotChoices = selected ? getSlotChoices(character, selected.spell) : []
  const globalOptions = selected ? getEffectiveSpellResourceOptions(character, selected.spell) : { useSlots: true, resources: [] }
  const resourceChoices = selected ? getResourceChoices(character, selected, slotChoices) : []
  const selectedBaseCost = selected?.sourceResourceCost?.resource === castingResource
    ? selected.sourceResourceCost
    : globalOptions.resources.find((cost) => cost.resource === castingResource)
  const selectedCost = selected && selectedBaseCost ? getUpcastResourceCost(selected.spell, selectedBaseCost, castLevel) : undefined
  const asksCastLevel = Boolean(selected && selected.spell.slotLevel > 0 && selected.spell.higherLevelText?.trim() && (castingResource === "slot" || selectedBaseCost))

  function openSpell(entry: MinimalSpellEntry) {
    setSelected(entry); setError(""); setConfirmConcentrationReplacement(false); setCastLevel(entry.spell.slotLevel)
    if (entry.sourceResourceCost) return setCastingResource(entry.sourceResourceCost.resource)
    if (entry.sourceCastingMode === "source" && entry.sourceUsageSource) return setCastingResource("ability")
    const choices = getSlotChoices(character, entry.spell)
    if (entry.sourceCastingMode === "slots" && globalPayment(entry).useSlots && (entry.spell.slotLevel === 0 || choices.length)) {
      setCastLevel(choices[0]?.level ?? entry.spell.slotLevel); return setCastingResource("slot")
    }
    const cost = globalPayment(entry).resources.find((candidate) => canPaySpellResourceCost(character, candidate)) ?? globalPayment(entry).resources[0]
    setCastingResource(cost?.resource ?? "slot")
  }

  function globalPayment(entry: MinimalSpellEntry) { return getEffectiveSpellResourceOptions(character, entry.spell) }
  function changeCastingResource(value: CastingResource) { setCastingResource(value); if (selected) setCastLevel(value === "slot" ? getSlotChoices(character, selected.spell)[0]?.level ?? selected.spell.slotLevel : selected.spell.slotLevel) }
  function castSelected() { if (!selected) return; if (selected.spell.concentration && currentConcentration) return setConfirmConcentrationReplacement(true); executeSelectedCast() }
  function finishCast() { setConfirmConcentrationReplacement(false); setSelected(null) }

  function executeSelectedCast() {
    if (!selected) return
    const spell = selected.spell
    if (castingResource === "ability") {
      if (!selected.sourceUsageSource || (selected.sourceUsageRemaining ?? 0) <= 0) { setError("Não há cargas disponíveis nesta habilidade."); return }
      updateCharacter(character.get("id"), (current) => { let next = spendGrantedSpellAbilityUse(current, selected.sourceUsageSource!); if (spell.concentration) next = beginSpellConcentration(next, spell); return next }); finishCast(); return
    }
    if (castingResource !== "slot") {
      const baseCost = selected.sourceResourceCost?.resource === castingResource ? selected.sourceResourceCost : globalOptions.resources.find((candidate) => candidate.resource === castingResource)
      const cost = baseCost ? getUpcastResourceCost(spell, baseCost, castLevel) : undefined
      if (!cost || !canPaySpellResourceCost(character, cost)) { setError(`Não há ${cost ? spellResourceLabel(cost.resource) : "recurso"} suficiente.`); return }
      updateCharacter(character.get("id"), (current) => { let next = spendSpellResourceCost(current, cost); if (spell.concentration) next = beginSpellConcentration(next, spell); return next }); finishCast(); return
    }
    if (selected.sourceCastingMode !== "slots" || !globalOptions.useSlots) { setError("Esta magia não usa espaços de magia."); return }
    if (spell.slotLevel === 0) { if (spell.concentration) updateCharacter(character.get("id"), (current) => beginSpellConcentration(current, spell)); finishCast(); return }
    const choices = getSlotChoices(character, spell)
    const level = asksCastLevel ? castLevel : choices[0]?.level
    const sameLevel = choices.filter((choice) => choice.level === level)
    const choice = sameLevel.find((entry) => entry.pool === "normal") ?? sameLevel[0] ?? choices[0]
    if (!choice) { setError("Nenhum espaço compatível disponível."); return }
    updateCharacter(character.get("id"), (current) => { let next = choice.pool === "pact" ? current.spendPactSlot() : current.spendSpellSlot(choice.level); if (spell.concentration) next = beginSpellConcentration(next, spell); return next }); finishCast()
  }

  const useDisabled = selected ? castingResource === "ability" ? !selected.sourceUsageSource || (selected.sourceUsageRemaining ?? 0) <= 0 : castingResource === "slot" ? selected.sourceCastingMode !== "slots" || !globalOptions.useSlots || (selected.spell.slotLevel > 0 && slotChoices.length === 0) : !selectedCost || !canPaySpellResourceCost(character, selectedCost) : true

  return <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
    {allSpells.length ? <>
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xs font-semibold uppercase tracking-wide text-textH">Magias</h2><p className="mt-1 text-[10px] text-textMuted">Magias conhecidas, preparadas ou concedidas.</p></div>{availableLevels.length > 1 ? <label className="grid gap-1 text-[10px] text-textMuted">Nível<select className="h-8 rounded-lg border border-border bg-bg px-2 text-xs text-textH" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value === "all" ? "all" : Number(e.target.value))}><option value="all">Todos</option>{availableLevels.map((level) => <option key={level} value={level}>{level === 0 ? "Truques" : `Nível ${level}`}</option>)}</select></label> : null}</div>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:grid-cols-4">{ACTION_FILTERS.map((option) => <button key={option.value} type="button" onClick={() => setActionFilter(option.value)} className={cn("rounded-md px-2 py-2 text-xs font-semibold", actionFilter === option.value ? "bg-accentBg text-textH" : "text-textMuted")}>{option.label}</button>)}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{visibleSpells.map((entry) => <button key={entry.key} type="button" onClick={() => openSpell(entry)} className="min-h-14 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left hover:border-accentBorder hover:bg-accentBg"><div className="truncate text-xs font-semibold text-textH">{spellName(entry.spell)}</div><div className="mt-1 text-[10px] text-textMuted">{entry.spell.slotLevel === 0 ? "Truque" : `N${entry.spell.slotLevel}`} • {sourceLabel(entry.source)}</div>{entry.sourceResourceCost ? <div className="mt-1 text-[10px] font-semibold text-accent">{entry.sourceResourceCost.amount} {spellResourceLabel(entry.sourceResourceCost.resource)}</div> : null}</button>)}</div>
    </> : null}

    {hasMagicResources ? <div className="mt-4 border-t border-border pt-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Recursos mágicos</div><div className="mt-2 flex flex-wrap gap-2">
      {Object.entries(slots).map(([level, slot]) => slot && slot.max > 0 ? <ResourcePill key={level} label={`N${level}`} current={slot.current} max={slot.max} onDecrease={() => updateCharacter(character.get("id"), (current) => spendSpellSlot(current, Number(level) as MagicCircleLevel))} onIncrease={() => updateCharacter(character.get("id"), (current) => restoreSpellSlot(current, Number(level) as MagicCircleLevel))} /> : null)}
      {pactSlots?.max ? <ResourcePill label={`Pacto N${pactSlots.level}`} current={pactSlots.current} max={pactSlots.max} onDecrease={() => updateCharacter(character.get("id"), spendPactSlot)} onIncrease={() => updateCharacter(character.get("id"), restorePactSlot)} /> : null}
      {sorceryPoints.max > 0 ? <ResourcePill label="Pontos de magia" current={sorceryPoints.current} max={sorceryPoints.max} onDecrease={() => updateCharacter(character.get("id"), spendSorceryPoint)} onIncrease={() => updateCharacter(character.get("id"), restoreSorceryPoint)} /> : null}
      {channelDivinity ? <ResourcePill label="Canalizar Divindade" current={channelDivinity.current} max={channelDivinity.max} onDecrease={() => updateCharacter(character.get("id"), spendChannelDivinity)} onIncrease={() => updateCharacter(character.get("id"), restoreChannelDivinity)} /> : null}
      {ki ? <ResourcePill label="Ki" current={ki.current} max={ki.max} onDecrease={() => updateCharacter(character.get("id"), spendKi)} onIncrease={() => updateCharacter(character.get("id"), restoreKi)} /> : null}
    </div></div> : null}

    {selected ? <Modal title={spellName(selected.spell)} onClose={() => setSelected(null)} className="max-w-xl"><div className="grid gap-3"><div className="text-xs text-textMuted">{sourceLabel(selected.source)}{selected.spell.concentration ? " • Concentração" : ""}</div><p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-text">{selected.spell.description}</p>{resourceChoices.length > 1 ? <label className="grid gap-1 text-xs text-textMuted">Recurso<select className="h-9 rounded-lg border border-border bg-bg px-2 text-textH" value={castingResource} onChange={(event) => changeCastingResource(event.target.value as CastingResource)}>{resourceChoices.map((choice) => <option key={choice.value} value={choice.value} disabled={choice.disabled}>{choice.label}</option>)}</select></label> : null}{asksCastLevel ? <label className="grid gap-1 text-xs text-textMuted">Nível de conjuração<select className="h-9 rounded-lg border border-border bg-bg px-2 text-textH" value={castLevel ?? selected.spell.slotLevel} onChange={(event) => setCastLevel(Number(event.target.value))}>{getCastLevels(selected.spell, castingResource, slotChoices).map((level) => <option key={level} value={level}>Nível {level}{selectedBaseCost ? ` — ${getUpcastResourceCost(selected.spell, selectedBaseCost, level).amount} ${spellResourceLabel(selectedBaseCost.resource)}` : ""}</option>)}</select></label> : null}{error ? <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{error}</div> : null}{confirmConcentrationReplacement ? <div className="rounded-lg border border-warning bg-bg-subtle p-3 text-xs text-text"><p>O personagem já está concentrando. Usar esta magia encerra a concentração atual.</p><div className="mt-2 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmConcentrationReplacement(false)}>Cancelar</Button><Button variant="primary" onClick={executeSelectedCast}>Substituir</Button></div></div> : <div className="flex justify-end border-t border-border pt-3"><Button variant="primary" disabled={useDisabled} onClick={castSelected}>Usar</Button></div>}</div></Modal> : null}
  </section>
}

function getUpcastResourceCost(spell: Spell, baseCost: SpellResourceCost, castLevel: number | null): SpellResourceCost { const level = Math.max(spell.slotLevel, Math.min(9, Math.trunc(castLevel ?? spell.slotLevel))); return { ...baseCost, amount: baseCost.amount + Math.max(0, level - spell.slotLevel) } }
function getResourceChoices(character: CharacterTemplate, entry: MinimalSpellEntry, slotChoices: SlotChoice[]) { if (entry.sourceResourceCost) return [{ value: entry.sourceResourceCost.resource as CastingResource, label: `${entry.sourceResourceCost.amount} ${spellResourceLabel(entry.sourceResourceCost.resource)}`, disabled: !canPaySpellResourceCost(character, entry.sourceResourceCost) }]; if (entry.sourceCastingMode === "source") return [{ value: "ability" as CastingResource, label: `${entry.sourceUsageLabel || sourceLabel(entry.source)} — ${entry.sourceUsageRemaining ?? 0}/${entry.sourceUsageMaximum ?? 0} usos`, disabled: (entry.sourceUsageRemaining ?? 0) <= 0 }]; const list: Array<{ value: CastingResource; label: string; disabled: boolean }> = []; const payment = getEffectiveSpellResourceOptions(character, entry.spell); if (payment.useSlots) list.push({ value: "slot", label: "Espaço de magia", disabled: entry.spell.slotLevel > 0 && !slotChoices.length }); for (const cost of payment.resources) list.push({ value: cost.resource, label: `${cost.amount} ${spellResourceLabel(cost.resource)}`, disabled: !canPaySpellResourceCost(character, cost) }); return list }
function buildAvailableSpells(character: CharacterTemplate, getSpellByIndex: (index: string) => Spell | undefined): MinimalSpellEntry[] { const classes = character.get("sheet").classes ?? [], entries: MinimalSpellEntry[] = []; for (const known of character.get("magic")?.spells.knownSpells ?? []) { const spell = getSpellByIndex(known.spells.id); if (!spell) continue; const alwaysAvailable = isAlwaysAvailableSpell(spell, known.source, classes); if (!alwaysAvailable && !known.spells.prepared) continue; entries.push({ key: `known:${known.source.type}:${known.source.sourceId}:${spell.index}`, spell, source: known.source, sourceCastingMode: "slots" }) } for (const grant of getCharacterGrantedSpells(character)) { const spell = getSpellByIndex(grant.index); if (!spell) continue; const maximum = grant.usage ? getAbilityUsageMax(character, grant.usage) : undefined, remaining = grant.usage && maximum !== undefined ? Math.max(0, maximum - grant.usage.used) : undefined; entries.push({ key: grant.key, spell, source: grant.source, sourceCastingMode: grant.resourceCost ? "source" : grant.castingMode === "known" ? "slots" : "source", sourceUsageRemaining: remaining, sourceUsageMaximum: maximum, sourceUsageLabel: grant.usageSource ? grant.source.name || "Carga de habilidade" : undefined, sourceUsageSource: grant.usageSource, sourceResourceCost: grant.resourceCost }) } return entries }
function getCastLevels(spell: Spell, resource: CastingResource, slots: SlotChoice[]): number[] { if (resource === "slot") return Array.from(new Set(slots.map((choice) => choice.level))); return Array.from({ length: Math.max(1, 10 - spell.slotLevel) }, (_, index) => spell.slotLevel + index).filter((level) => level >= 1 && level <= 9) }
function isAlwaysAvailableSpell(spell: Spell, source: SpellSource, classes: CharacterClassInterface[]): boolean { if (spell.slotLevel === 0 || source.type !== "class") return true; const data = classes.find((entry) => entry.className === source.name); return !data?.knownSpells || data.knownSpells.mode === "limited" }
function normalizeCastingTime(spell: Spell): ActionFilter { return spell.castingTime.type === "bonusAction" ? "bonusAction" : spell.castingTime.type === "reaction" ? "reaction" : spell.castingTime.type === "action" ? "action" : "other" }
function getSlotChoices(character: CharacterTemplate, spell: Spell): SlotChoice[] { if (spell.slotLevel <= 0) return []; const choices: SlotChoice[] = []; for (const [text, slot] of Object.entries(character.getSpellSlots())) { const level = Number(text) as MagicCircleLevel; if (slot && slot.current > 0 && level >= spell.slotLevel) choices.push({ level, pool: "normal" }) } const pact = character.getPactSlots(); if (pact && pact.current > 0 && pact.level >= spell.slotLevel) choices.push({ level: pact.level as MagicCircleLevel, pool: "pact" }); return choices.sort((a, b) => a.level - b.level) }
function ResourcePill({ label, current, max, onDecrease, onIncrease }: { label: string; current: number; max: number; onDecrease?: () => void; onIncrease?: () => void }) { return <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-2.5 py-2 text-xs"><span className="font-semibold text-textH">{label}</span><span className="text-textMuted">{current}/{max}</span>{onDecrease || onIncrease ? <div className="ml-auto flex gap-1"><button type="button" disabled={!onDecrease || current <= 0} onClick={onDecrease}>−</button><button type="button" disabled={!onIncrease || current >= max} onClick={onIncrease}>+</button></div> : null}</div> }
function spellName(spell: Spell) { return spell.displayName || spell.name }
function sourceLabel(source: SpellSource) { if (source.type === "class") return CLASS_NAMES[source.name as keyof typeof CLASS_NAMES] ?? source.name ?? "Classe"; return source.name || "Habilidade" }
