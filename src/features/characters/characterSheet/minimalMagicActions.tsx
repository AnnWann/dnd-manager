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
import { canPaySpellResourceCost, getEffectiveSpellResourceOptions, getSpellResourceCurrent, spellResourceLabel, spendSpellResourceCost } from "../../../models/magic/spells/spellResourceCost"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"
import type { CharacterClassInterface } from "../../../models/sheet/Class"

type ActionFilter = "action" | "bonusAction" | "reaction" | "other"
type CastingResource = "slot" | "ability" | SpellResourceType
type Props = { character: CharacterTemplate; updateCharacter: (characterId: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void }
type MinimalSpellEntry = { key: string; spell: Spell; source: SpellSource; sourceCastingMode: "slots" | "source"; sourceUsageRemaining?: number; sourceUsageMaximum?: number; sourceUsageLabel?: string; sourceUsageSource?: CharacterGrantedSpellUsageSource }
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

  const slotChoices = selected ? getSlotChoices(character, selected.spell) : []
  const currentConcentration = getConcentrationCondition(character)
  const options = selected ? getEffectiveSpellResourceOptions(character, selected.spell) : { useSlots: true, resources: [] }
  const selectedBaseCost = options.resources.find((cost) => cost.resource === castingResource)
  const selectedCost = selected && selectedBaseCost ? getUpcastResourceCost(selected.spell, selectedBaseCost, castLevel) : undefined
  const asksCastLevel = Boolean(selected && selected.spell.slotLevel > 0 && selected.sourceCastingMode === "slots" && selected.spell.higherLevelText?.trim() && (castingResource === "slot" || selectedBaseCost))

  function openSpell(entry: MinimalSpellEntry) {
    setSelected(entry); setError(""); setConfirmConcentrationReplacement(false)
    const choices = getSlotChoices(character, entry.spell)
    if (entry.sourceCastingMode === "source" || (entry.sourceUsageSource && (entry.sourceUsageRemaining ?? 0) > 0)) { setCastLevel(entry.spell.slotLevel); return setCastingResource("ability") }
    const payment = getEffectiveSpellResourceOptions(character, entry.spell)
    if (payment.useSlots && (entry.spell.slotLevel === 0 || choices.length > 0)) { setCastLevel(choices[0]?.level ?? entry.spell.slotLevel); return setCastingResource("slot") }
    const cost = payment.resources.find((candidate) => canPaySpellResourceCost(character, candidate)) ?? payment.resources[0]
    setCastLevel(entry.spell.slotLevel)
    setCastingResource(cost?.resource ?? "slot")
  }
  function changeCastingResource(value: CastingResource) {
    setCastingResource(value)
    if (!selected) return
    if (value === "slot") setCastLevel(getSlotChoices(character, selected.spell)[0]?.level ?? selected.spell.slotLevel)
    else setCastLevel(selected.spell.slotLevel)
  }
  function castSelected() { if (!selected) return; if (selected.spell.concentration && currentConcentration) return setConfirmConcentrationReplacement(true); executeSelectedCast() }
  function finishCast() { setConfirmConcentrationReplacement(false); setSelected(null) }
  function executeSelectedCast() {
    if (!selected) return
    const spell = selected.spell
    const useAbility = selected.sourceCastingMode === "source" || (Boolean(selected.sourceUsageSource && selected.sourceUsageMaximum !== undefined) && castingResource === "ability")
    if (useAbility) {
      if (!selected.sourceUsageSource || (selected.sourceUsageRemaining ?? 0) <= 0) { setError("Não há cargas disponíveis nesta habilidade."); setConfirmConcentrationReplacement(false); return }
      updateCharacter(character.get("id"), (current) => { let next = spendGrantedSpellAbilityUse(current, selected.sourceUsageSource!); if (spell.concentration) next = beginSpellConcentration(next, spell); return next }); finishCast(); return
    }
    if (castingResource !== "slot") {
      const baseCost = options.resources.find((candidate) => candidate.resource === castingResource)
      const cost = baseCost ? getUpcastResourceCost(spell, baseCost, castLevel) : undefined
      if (!cost || !canPaySpellResourceCost(character, cost)) { setError(`Não há ${cost ? spellResourceLabel(cost.resource) : "recurso"} suficiente para conjurar esta magia neste nível.`); setConfirmConcentrationReplacement(false); return }
      updateCharacter(character.get("id"), (current) => { let next = spendSpellResourceCost(current, cost); if (spell.concentration) next = beginSpellConcentration(next, spell); return next }); finishCast(); return
    }
    if (!options.useSlots) { setError("Esta magia não está configurada para usar espaços de magia."); return }
    if (spell.slotLevel === 0) { if (spell.concentration) updateCharacter(character.get("id"), (current) => beginSpellConcentration(current, spell)); finishCast(); return }
    const choices = getSlotChoices(character, spell)
    if (!choices.length) { setError("Nenhum espaço de magia compatível está disponível."); setConfirmConcentrationReplacement(false); return }
    const level = asksCastLevel ? castLevel : choices[0].level, sameLevel = choices.filter((choice) => choice.level === level), choice = sameLevel.find((entry) => entry.pool === "normal") ?? sameLevel[0] ?? choices[0]
    updateCharacter(character.get("id"), (current) => { let next = choice.pool === "pact" ? current.spendPactSlot() : current.spendSpellSlot(choice.level); if (spell.concentration) next = beginSpellConcentration(next, spell); return next }); finishCast()
  }

  const resourceChoices = selected ? getResourceChoices(character, selected, slotChoices) : []
  const useDisabled = selected ? castingResource === "ability" ? selected.sourceUsageRemaining === 0 || !selected.sourceUsageSource : castingResource === "slot" ? !options.useSlots || (selected.spell.slotLevel > 0 && slotChoices.length === 0) : !selectedCost || !canPaySpellResourceCost(character, selectedCost) : true
  const abilityResources = new Map<string, { label: string; current: number; max: number }>()
  for (const entry of allSpells) if (entry.sourceUsageSource && entry.sourceUsageMaximum !== undefined) { const key = JSON.stringify(entry.sourceUsageSource); if (!abilityResources.has(key)) abilityResources.set(key, { label: entry.sourceUsageLabel || sourceLabel(entry.source), current: entry.sourceUsageRemaining ?? 0, max: entry.sourceUsageMaximum }) }

  return <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
    {allSpells.length ? <>
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xs font-semibold uppercase tracking-wide text-textH">Magias</h2><p className="mt-1 text-[10px] leading-4 text-textMuted">Magias conhecidas, preparadas ou concedidas por habilidades e equipamentos.</p></div>{availableLevels.length > 1 ? <label className="grid gap-1 text-[10px] text-textMuted">Nível<select className="h-8 rounded-lg border border-border bg-bg px-2 text-xs text-textH" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value === "all" ? "all" : Number(e.target.value))}><option value="all">Todos</option>{availableLevels.map((level) => <option key={level} value={level}>{level === 0 ? "Truques" : `Nível ${level}`}</option>)}</select></label> : null}</div>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:grid-cols-4">{ACTION_FILTERS.map((option) => <button key={option.value} type="button" aria-pressed={actionFilter === option.value} onClick={() => setActionFilter(option.value)} className={cn("rounded-md px-2 py-2 text-xs font-semibold transition-colors", actionFilter === option.value ? "bg-accentBg text-textH shadow-theme-sm" : "text-textMuted hover:bg-bg hover:text-textH")}>{option.label}</button>)}</div>
      {visibleSpells.length ? <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{visibleSpells.map((entry) => { const payment = getEffectiveSpellResourceOptions(character, entry.spell), label = formatPayment(payment.useSlots, payment.resources); return <button key={entry.key} type="button" onClick={() => openSpell(entry)} className="min-h-14 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left transition-colors hover:border-accentBorder hover:bg-accentBg"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-textH">{spellName(entry.spell)}</div><div className="mt-1 flex min-w-0 gap-1.5 text-[10px] text-textMuted"><span>{entry.spell.slotLevel === 0 ? "Truque" : `N${entry.spell.slotLevel}`}</span><span>•</span><span className="truncate">{sourceLabel(entry.source)}</span></div>{label ? <div className="mt-1 truncate text-[10px] font-semibold text-accent">{label}</div> : null}</div>{entry.sourceUsageMaximum !== undefined ? <span className="shrink-0 rounded-md border border-accentBorder bg-accentBg px-2 py-1 text-[10px] font-semibold text-textH">{entry.sourceUsageRemaining ?? 0}/{entry.sourceUsageMaximum} usos</span> : null}</div></button> })}</div> : <div className="mt-2 rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-3 text-xs text-textMuted">Nenhuma magia disponível nesta categoria e nível.</div>}
    </> : null}

    {hasMagicResources ? <div className={allSpells.length ? "mt-4 border-t border-border pt-3" : ""}><div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Recursos mágicos</div><div className="mt-2 flex flex-wrap gap-2">
      {Object.entries(slots).map(([level, slot]) => slot && slot.max > 0 ? <ResourcePill key={level} label={`N${level}`} current={slot.current} max={slot.max} onDecrease={() => updateCharacter(character.get("id"), (current) => spendSpellSlot(current, Number(level) as MagicCircleLevel))} onIncrease={() => updateCharacter(character.get("id"), (current) => restoreSpellSlot(current, Number(level) as MagicCircleLevel))} /> : null)}
      {pactSlots?.max ? <ResourcePill label={`Pacto N${pactSlots.level}`} current={pactSlots.current} max={pactSlots.max} accent onDecrease={() => updateCharacter(character.get("id"), spendPactSlot)} onIncrease={() => updateCharacter(character.get("id"), restorePactSlot)} /> : null}
      {sorceryPoints.max > 0 ? <ResourcePill label="Pontos de magia" current={sorceryPoints.current} max={sorceryPoints.max} onDecrease={() => updateCharacter(character.get("id"), spendSorceryPoint)} onIncrease={() => updateCharacter(character.get("id"), restoreSorceryPoint)} /> : null}
      {channelDivinity ? <ResourcePill label="Canalizar Divindade" current={channelDivinity.current} max={channelDivinity.max} accent onDecrease={() => updateCharacter(character.get("id"), spendChannelDivinity)} onIncrease={() => updateCharacter(character.get("id"), restoreChannelDivinity)} /> : null}
      {ki ? <ResourcePill label="Ki" current={ki.current} max={ki.max} accent onDecrease={() => updateCharacter(character.get("id"), spendKi)} onIncrease={() => updateCharacter(character.get("id"), restoreKi)} /> : null}
      {Array.from(abilityResources.entries()).map(([key, resource]) => <ResourcePill key={key} label={resource.label} current={resource.current} max={resource.max} accent />)}
    </div></div> : null}

    {selected ? <Modal title={spellName(selected.spell)} onClose={() => setSelected(null)} className="max-w-xl"><div className="grid gap-3"><div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted"><span>{selected.spell.slotLevel === 0 ? "Truque" : `Nível ${selected.spell.slotLevel}`}</span><span>• {actionFilterLabel(normalizeCastingTime(selected.spell))}</span><span>• {sourceLabel(selected.source)}</span>{selected.spell.concentration ? <span>• Concentração</span> : null}</div><p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-text">{selected.spell.description?.trim() || "Sem descrição."}</p>{selected.spell.higherLevelText?.trim() ? <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs leading-5 text-text"><div className="font-semibold text-textH">Em níveis superiores</div><div className="mt-1 whitespace-pre-wrap">{selected.spell.higherLevelText}</div></div> : null}
      {resourceChoices.length > 1 ? <label className="grid gap-1 text-xs text-textMuted">Recurso para conjurar<select className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH" value={castingResource} onChange={(e) => changeCastingResource(e.target.value as CastingResource)}>{resourceChoices.map((choice) => <option key={choice.value} value={choice.value} disabled={choice.disabled}>{choice.label}</option>)}</select></label> : resourceChoices[0] ? <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">Recurso: <strong className="text-textH">{resourceChoices[0].label}</strong></div> : null}
      {asksCastLevel ? <label className="grid gap-1 text-xs text-textMuted">Nível de conjuração<select className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH" value={castLevel ?? selected.spell.slotLevel} onChange={(e) => setCastLevel(Number(e.target.value))}>{castingResource === "slot" ? Array.from(new Set(slotChoices.map((choice) => choice.level))).map((level) => <option key={level} value={level}>Nível {level}</option>) : getResourceUpcastLevels(selected.spell).map((level) => <option key={level} value={level}>Nível {level}</option>)}</select></label> : null}
      {castingResource !== "slot" && castingResource !== "ability" && selectedCost ? <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs text-text">Consome <strong>{selectedCost.amount} {spellResourceLabel(selectedCost.resource)}</strong>{castLevel && castLevel > selected.spell.slotLevel ? ` para conjurar no nível ${castLevel}` : ""}. Disponível: {getSpellResourceCurrent(character, selectedCost.resource)}.</div> : null}
      {selected.sourceCastingMode === "source" ? <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">Esta magia é conjurada pela própria origem e não consome espaço de magia.{selected.sourceUsageMaximum !== undefined ? ` ${selected.sourceUsageRemaining}/${selected.sourceUsageMaximum} usos disponíveis na origem.` : ""}</div> : null}
      {error ? <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{error}</div> : null}<div className="flex justify-end border-t border-border pt-3"><Button variant="primary" disabled={useDisabled} onClick={castSelected}>Usar</Button></div></div></Modal> : null}

    {selected && confirmConcentrationReplacement ? <Modal title="Substituir concentração?" onClose={() => setConfirmConcentrationReplacement(false)} className="max-w-md"><div className="grid gap-3"><p className="text-sm leading-6 text-text">O personagem já está concentrando{currentConcentration?.source ? ` em ${currentConcentration.source}` : " em outra magia"}. Conjurar <strong>{spellName(selected.spell)}</strong> encerrará a concentração anterior.</p><p className="text-xs leading-5 text-textMuted">O recurso da nova magia só será gasto depois da confirmação.</p><div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3"><Button variant="secondary" onClick={() => setConfirmConcentrationReplacement(false)}>Cancelar</Button><Button variant="primary" onClick={executeSelectedCast}>Conjurar e substituir</Button></div></div></Modal> : null}
  </section>
}

function getUpcastResourceCost(spell: Spell, baseCost: SpellResourceCost, castLevel: number | null): SpellResourceCost {
  const level = Math.max(spell.slotLevel, Math.min(9, Math.trunc(castLevel ?? spell.slotLevel)))
  return { ...baseCost, amount: baseCost.amount + Math.max(0, level - spell.slotLevel) }
}
function getResourceUpcastLevels(spell: Spell): number[] { return Array.from({ length: Math.max(1, 10 - spell.slotLevel) }, (_, index) => spell.slotLevel + index).filter((level) => level >= 1 && level <= 9) }
function getResourceChoices(character: CharacterTemplate, entry: MinimalSpellEntry, slotChoices: SlotChoice[]) {
  if (entry.sourceCastingMode === "source") return [{ value: "ability" as CastingResource, label: `${entry.sourceUsageLabel || sourceLabel(entry.source)} — ${entry.sourceUsageRemaining ?? 0}/${entry.sourceUsageMaximum ?? 0} usos`, disabled: (entry.sourceUsageRemaining ?? 0) <= 0 }]
  const list: Array<{ value: CastingResource; label: string; disabled: boolean }> = []
  if (entry.sourceUsageSource) list.push({ value: "ability", label: `${entry.sourceUsageLabel || sourceLabel(entry.source)} — ${entry.sourceUsageRemaining ?? 0}/${entry.sourceUsageMaximum ?? 0} usos`, disabled: (entry.sourceUsageRemaining ?? 0) <= 0 })
  const payment = getEffectiveSpellResourceOptions(character, entry.spell)
  if (payment.useSlots) list.push({ value: "slot", label: entry.spell.slotLevel === 0 ? "Sem custo (truque)" : "Espaço de magia", disabled: entry.spell.slotLevel > 0 && slotChoices.length === 0 })
  for (const cost of payment.resources) list.push({ value: cost.resource, label: `${cost.amount} ${spellResourceLabel(cost.resource)}`, disabled: !canPaySpellResourceCost(character, cost) })
  return list
}
function formatPayment(useSlots: boolean, resources: SpellResourceCost[]) { const labels = [...(useSlots ? ["Espaço"] : []), ...resources.map((cost) => `${cost.amount} ${spellResourceLabel(cost.resource)}`)]; return labels.length > 1 ? labels.join(" / ") : resources.length ? labels[0] : "" }
function buildAvailableSpells(character: CharacterTemplate, getSpellByIndex: (index: string) => Spell | undefined): MinimalSpellEntry[] {
  const classes = character.get("sheet").classes ?? [], entries: MinimalSpellEntry[] = []
  for (const known of character.get("magic")?.spells.knownSpells ?? []) { const spell = getSpellByIndex(known.spells.id); if (!spell) continue; const alwaysAvailable = isAlwaysAvailableSpell(spell, known.source, classes); if (!alwaysAvailable && !known.spells.prepared) continue; entries.push({ key: `known:${known.source.type}:${known.source.sourceId}:${spell.index}`, spell, source: known.source, sourceCastingMode: "slots" }) }
  for (const grant of getCharacterGrantedSpells(character)) { const spell = getSpellByIndex(grant.index); if (!spell) continue; const maximum = grant.usage ? getAbilityUsageMax(character, grant.usage) : undefined, remaining = grant.usage && maximum !== undefined ? Math.max(0, maximum - grant.usage.used) : undefined; entries.push({ key: grant.key, spell, source: grant.source, sourceCastingMode: grant.castingMode === "known" ? "slots" : "source", sourceUsageRemaining: remaining, sourceUsageMaximum: maximum, sourceUsageLabel: grant.usageSource ? grant.source.name || "Carga de habilidade" : undefined, sourceUsageSource: grant.usageSource }) }
  return entries
}
function isAlwaysAvailableSpell(spell: Spell, source: SpellSource, classes: CharacterClassInterface[]): boolean { if (spell.slotLevel === 0 || source.type !== "class") return true; const data = classes.find((entry) => entry.className === source.name); return !data?.knownSpells || data.knownSpells.mode === "limited" }
function normalizeCastingTime(spell: Spell): ActionFilter { return spell.castingTime.type === "bonusAction" ? "bonusAction" : spell.castingTime.type === "reaction" ? "reaction" : spell.castingTime.type === "action" ? "action" : "other" }
function getSlotChoices(character: CharacterTemplate, spell: Spell): SlotChoice[] { if (spell.slotLevel <= 0) return []; const choices: SlotChoice[] = []; for (const [text, slot] of Object.entries(character.getSpellSlots())) { const level = Number(text) as MagicCircleLevel; if (slot && slot.current > 0 && level >= spell.slotLevel) choices.push({ level, pool: "normal" }) } const pact = character.getPactSlots(); if (pact && pact.current > 0 && pact.level >= spell.slotLevel) choices.push({ level: pact.level as MagicCircleLevel, pool: "pact" }); return choices.sort((a, b) => a.level - b.level || (a.pool === "normal" ? -1 : 1)) }
function ResourcePill({ label, current, max, accent = false, onDecrease, onIncrease }: { label: string; current: number; max: number; accent?: boolean; onDecrease?: () => void; onIncrease?: () => void }) { return <div className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs", accent ? "border-accentBorder bg-accentBg" : "border-border bg-bg-subtle")}><div><span className="font-semibold text-textH">{label}</span> <span className="text-textMuted">{current}/{max}</span></div>{onDecrease || onIncrease ? <div className="ml-auto flex gap-1"><button type="button" disabled={!onDecrease || current <= 0} onClick={onDecrease} className="grid h-6 w-6 place-items-center rounded-md border border-border bg-bg disabled:opacity-35">−</button><button type="button" disabled={!onIncrease || current >= max} onClick={onIncrease} className="grid h-6 w-6 place-items-center rounded-md border border-border bg-bg disabled:opacity-35">+</button></div> : null}</div> }
function spellName(spell: Spell) { return spell.displayName || spell.name }
function sourceLabel(source: SpellSource) { if (source.type === "class") return CLASS_NAMES[source.name as keyof typeof CLASS_NAMES] ?? source.name ?? "Classe"; return source.name || (source.type === "equipment" ? "Equipamento" : source.type === "race" ? "Raça" : source.type === "feat" ? "Talento" : "Habilidade") }
function actionFilterLabel(filter: ActionFilter) { return filter === "bonusAction" ? "Ação bônus" : filter === "reaction" ? "Reação" : filter === "other" ? "Outro tempo" : "Ação" }
