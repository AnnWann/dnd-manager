import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { CLASS_NAMES } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import { cn } from "../../../lib/cn"
import { getCharacterGrantedSpells, spendGrantedSpellAbilityUse, type CharacterGrantedSpellUsageSource } from "../../../models/characters/characterGrantedSpells"
import { getSorceryPoints } from "../../../models/characters/characterMagic"
import { getAbilityUsageMax } from "../../../models/abilities/abilityActivation"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { CharacterClassInterface } from "../../../models/sheet/Class"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"

type ActionFilter = "action" | "bonusAction" | "reaction" | "other"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type MinimalSpellEntry = {
  key: string
  spell: Spell
  source: SpellSource
  sourceCastingMode: "slots" | "source"
  sourceUsageRemaining?: number
  sourceUsageMaximum?: number
  sourceUsageLabel?: string
  sourceUsageSource?: CharacterGrantedSpellUsageSource
}

type SlotChoice = {
  level: MagicCircleLevel
  pool: "normal" | "pact"
}

const ACTION_FILTERS: Array<{ value: ActionFilter; label: string }> = [
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
  { value: "other", label: "Outras" },
]

export function MinimalMagicActions({ character, updateCharacter }: Props) {
  const { getSpellByIndex } = useMagicContext()
  const [actionFilter, setActionFilter] = useState<ActionFilter>("action")
  const [levelFilter, setLevelFilter] = useState<number | "all">("all")
  const [selected, setSelected] = useState<MinimalSpellEntry | null>(null)
  const [castLevel, setCastLevel] = useState<number | null>(null)
  const [castingResource, setCastingResource] = useState<"slot" | "ability">("slot")
  const [error, setError] = useState("")

  const allSpells = useMemo(
    () => buildAvailableSpells(character, getSpellByIndex),
    [character, getSpellByIndex],
  )
  const availableLevels = useMemo(
    () => Array.from(new Set(allSpells.map((entry) => entry.spell.slotLevel))).sort((a, b) => a - b),
    [allSpells],
  )
  const visibleSpells = allSpells
    .filter((entry) => normalizeCastingTime(entry.spell) === actionFilter)
    .filter((entry) => levelFilter === "all" || entry.spell.slotLevel === levelFilter)
    .sort((left, right) =>
      left.spell.slotLevel - right.spell.slotLevel ||
      spellName(left.spell).localeCompare(spellName(right.spell), "pt-BR"),
    )

  const slots = character.getSpellSlots()
  const pactSlots = character.getPactSlots()
  const sorceryPoints = getSorceryPoints(character)
  const hasSlots = Object.values(slots).some((slot) => Boolean(slot && slot.max > 0))
  const hasPactSlots = Boolean(pactSlots && pactSlots.max > 0)
  const hasSorceryPoints = sorceryPoints.max > 0
  const abilityChargeResources = useMemo(() => {
    const resources = new Map<string, { label: string; current: number; max: number }>()
    for (const entry of allSpells) {
      if (!entry.sourceUsageSource || entry.sourceUsageMaximum === undefined) continue
      const key = JSON.stringify(entry.sourceUsageSource)
      if (resources.has(key)) continue
      resources.set(key, {
        label: entry.sourceUsageLabel || sourceLabel(entry.source),
        current: entry.sourceUsageRemaining ?? 0,
        max: entry.sourceUsageMaximum,
      })
    }
    return Array.from(resources.values())
  }, [allSpells])
  const hasAbilityCharges = abilityChargeResources.length > 0
  const hasMagicResources = hasSlots || hasPactSlots || hasSorceryPoints || hasAbilityCharges

  if (!allSpells.length && !hasMagicResources) return null

  const slotChoices = selected ? getSlotChoices(character, selected.spell) : []
  const asksCastLevel = Boolean(
    selected &&
      selected.spell.slotLevel > 0 &&
      selected.sourceCastingMode === "slots" &&
      selected.spell.higherLevelText?.trim(),
  )

  function openSpell(entry: MinimalSpellEntry) {
    setSelected(entry)
    setError("")
    const choices = getSlotChoices(character, entry.spell)
    setCastLevel(choices[0]?.level ?? null)
    setCastingResource(
      entry.sourceUsageSource && (entry.sourceUsageRemaining ?? 0) > 0
        ? "ability"
        : "slot",
    )
  }

  function castSelected() {
    if (!selected) return
    const spell = selected.spell

    const canUseAbilityCharge = Boolean(
      selected.sourceUsageSource && selected.sourceUsageMaximum !== undefined,
    )
    const useAbilityCharge =
      selected.sourceCastingMode === "source" ||
      (canUseAbilityCharge && castingResource === "ability")

    if (useAbilityCharge) {
      if (!selected.sourceUsageSource || (selected.sourceUsageRemaining ?? 0) <= 0) {
        setError("Não há cargas disponíveis nesta habilidade.")
        return
      }
      updateCharacter(character.get("id"), (current) =>
        spendGrantedSpellAbilityUse(current, selected.sourceUsageSource!),
      )
      setSelected(null)
      return
    }

    if (spell.slotLevel === 0) {
      setSelected(null)
      return
    }

    const choices = getSlotChoices(character, spell)
    if (!choices.length) {
      setError("Nenhum espaço de magia compatível está disponível.")
      return
    }

    const level = asksCastLevel ? castLevel : choices[0].level
    const sameLevel = choices.filter((choice) => choice.level === level)
    const choice = sameLevel.find((entry) => entry.pool === "normal") ?? sameLevel[0] ?? choices[0]

    updateCharacter(character.get("id"), (current) =>
      choice.pool === "pact"
        ? current.spendPactSlot()
        : current.spendSpellSlot(choice.level),
    )
    setSelected(null)
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      {allSpells.length ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-textH">Magias</h2>
              <p className="mt-1 text-[10px] leading-4 text-textMuted">
                Magias conhecidas, preparadas ou concedidas por habilidades e equipamentos.
              </p>
            </div>

            {availableLevels.length > 1 ? (
              <label className="grid gap-1 text-[10px] text-textMuted">
                Nível
                <select
                  className="h-8 rounded-lg border border-border bg-bg px-2 text-xs text-textH"
                  value={levelFilter}
                  onChange={(event) =>
                    setLevelFilter(event.target.value === "all" ? "all" : Number(event.target.value))
                  }
                >
                  <option value="all">Todos</option>
                  {availableLevels.map((level) => (
                    <option key={level} value={level}>
                      {level === 0 ? "Truques" : `Nível ${level}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:grid-cols-4">
            {ACTION_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={actionFilter === option.value}
                onClick={() => setActionFilter(option.value)}
                className={cn(
                  "rounded-md px-2 py-2 text-xs font-semibold transition-colors",
                  actionFilter === option.value
                    ? "bg-accentBg text-textH shadow-theme-sm"
                    : "text-textMuted hover:bg-bg hover:text-textH",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {visibleSpells.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {visibleSpells.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => openSpell(entry)}
                  className="min-h-14 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left transition-colors hover:border-accentBorder hover:bg-accentBg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-textH">{spellName(entry.spell)}</div>
                      <div className="mt-1 flex min-w-0 gap-1.5 text-[10px] text-textMuted">
                        <span className="shrink-0">{entry.spell.slotLevel === 0 ? "Truque" : `N${entry.spell.slotLevel}`}</span>
                        <span>•</span>
                        <span className="truncate">{sourceLabel(entry.source)}</span>
                      </div>
                    </div>
                    {entry.sourceUsageMaximum !== undefined ? (
                      <span className="shrink-0 rounded-md border border-accentBorder bg-accentBg px-2 py-1 text-[10px] font-semibold text-textH">
                        {entry.sourceUsageRemaining ?? 0}/{entry.sourceUsageMaximum} usos
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-3 text-xs text-textMuted">
              Nenhuma magia disponível nesta categoria e nível.
            </div>
          )}
        </>
      ) : null}

      {hasMagicResources ? (
        <div className={allSpells.length ? "mt-4 border-t border-border pt-3" : ""}>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Recursos mágicos</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(slots).map(([level, slot]) =>
              slot && slot.max > 0 ? (
                <ResourcePill key={level} label={`N${level}`} current={slot.current} max={slot.max} />
              ) : null,
            )}
            {pactSlots && pactSlots.max > 0 ? (
              <ResourcePill label={`Pacto N${pactSlots.level}`} current={pactSlots.current} max={pactSlots.max} accent />
            ) : null}
            {sorceryPoints.max > 0 ? (
              <ResourcePill label="Pontos de magia" current={sorceryPoints.current} max={sorceryPoints.max} />
            ) : null}
            {abilityChargeResources.map((resource) => (
              <ResourcePill
                key={`ability-charge:${resource.label}`}
                label={resource.label}
                current={resource.current}
                max={resource.max}
                accent
              />
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <Modal title={spellName(selected.spell)} onClose={() => setSelected(null)} className="max-w-xl">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              <span>{selected.spell.slotLevel === 0 ? "Truque" : `Nível ${selected.spell.slotLevel}`}</span>
              <span>• {actionFilterLabel(normalizeCastingTime(selected.spell))}</span>
              <span>• {sourceLabel(selected.source)}</span>
              {selected.spell.concentration ? <span>• Concentração</span> : null}
            </div>

            <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-text">
              {selected.spell.description?.trim() || "Sem descrição."}
            </p>

            {selected.spell.higherLevelText?.trim() ? (
              <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs leading-5 text-text">
                <div className="font-semibold text-textH">Em níveis superiores</div>
                <div className="mt-1 whitespace-pre-wrap">{selected.spell.higherLevelText}</div>
              </div>
            ) : null}

            {selected.sourceCastingMode === "source" ? (
              <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">
                Esta magia é conjurada pela própria origem e não consome espaço de magia.
                {selected.sourceUsageMaximum !== undefined
                  ? ` ${selected.sourceUsageRemaining}/${selected.sourceUsageMaximum} usos disponíveis na origem.`
                  : ""}
              </div>
            ) : null}

            {selected.sourceUsageSource && selected.sourceCastingMode === "slots" ? (
              <label className="grid gap-1 text-xs text-textMuted">
                Recurso para conjurar
                <select
                  className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                  value={castingResource}
                  onChange={(event) =>
                    setCastingResource(event.target.value as "slot" | "ability")
                  }
                >
                  <option
                    value="ability"
                    disabled={(selected.sourceUsageRemaining ?? 0) <= 0}
                  >
                    {selected.sourceUsageLabel || sourceLabel(selected.source)} — {selected.sourceUsageRemaining ?? 0}/{selected.sourceUsageMaximum ?? 0} usos
                  </option>
                  <option value="slot" disabled={selected.spell.slotLevel > 0 && slotChoices.length === 0}>
                    Espaço de magia
                  </option>
                </select>
              </label>
            ) : null}

            {asksCastLevel && castingResource === "slot" ? (
              <label className="grid gap-1 text-xs text-textMuted">
                Nível de conjuração
                <select
                  className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                  value={castLevel ?? ""}
                  onChange={(event) => setCastLevel(Number(event.target.value))}
                >
                  {Array.from(new Set(slotChoices.map((choice) => choice.level))).map((level) => (
                    <option key={level} value={level}>Nível {level}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{error}</div>
            ) : null}

            <div className="flex justify-end border-t border-border pt-3">
              <Button
                variant="primary"
                disabled={
                  selected.sourceCastingMode === "source"
                    ? selected.sourceUsageRemaining === 0
                    : castingResource === "ability"
                      ? selected.sourceUsageRemaining === 0
                      : selected.spell.slotLevel > 0 && slotChoices.length === 0
                }
                onClick={castSelected}
              >
                Usar
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function buildAvailableSpells(
  character: CharacterTemplate,
  getSpellByIndex: (index: string) => Spell | undefined,
): MinimalSpellEntry[] {
  const classes = character.get("sheet").classes ?? []
  const entries: MinimalSpellEntry[] = []

  for (const known of character.get("magic")?.spells.knownSpells ?? []) {
    const spell = getSpellByIndex(known.spells.id)
    if (!spell) continue
    const alwaysAvailable = isAlwaysAvailableSpell(spell, known.source, classes)
    if (!alwaysAvailable && !known.spells.prepared) continue
    entries.push({
      key: `known:${known.source.type}:${known.source.sourceId}:${spell.index}`,
      spell,
      source: known.source,
      sourceCastingMode: "slots",
    })
  }

  for (const grant of getCharacterGrantedSpells(character)) {
    const spell = getSpellByIndex(grant.index)
    if (!spell) continue
    const maximum = grant.usage ? getAbilityUsageMax(character, grant.usage) : undefined
    const remaining = grant.usage && maximum !== undefined
      ? Math.max(0, maximum - grant.usage.used)
      : undefined
    entries.push({
      key: grant.key,
      spell,
      source: grant.source,
      sourceCastingMode: grant.castingMode === "known" ? "slots" : "source",
      sourceUsageRemaining: remaining,
      sourceUsageMaximum: maximum,
      sourceUsageLabel: grant.usageSource ? grant.source.name || "Carga de habilidade" : undefined,
      sourceUsageSource: grant.usageSource,
    })
  }

  return entries
}

function isAlwaysAvailableSpell(
  spell: Spell,
  source: SpellSource,
  classes: CharacterClassInterface[],
): boolean {
  if (spell.slotLevel === 0 || source.type !== "class") return true
  const classData = classes.find((entry) => entry.className === source.name)
  if (!classData?.knownSpells) return true
  return classData.knownSpells.mode === "limited"
}

function normalizeCastingTime(spell: Spell): ActionFilter {
  if (spell.castingTime.type === "bonusAction") return "bonusAction"
  if (spell.castingTime.type === "reaction") return "reaction"
  if (spell.castingTime.type === "action") return "action"
  return "other"
}

function getSlotChoices(character: CharacterTemplate, spell: Spell): SlotChoice[] {
  if (spell.slotLevel <= 0) return []
  const choices: SlotChoice[] = []

  for (const [levelText, slot] of Object.entries(character.getSpellSlots())) {
    const level = Number(levelText) as MagicCircleLevel
    if (!slot || slot.current <= 0 || level < spell.slotLevel) continue
    choices.push({ level, pool: "normal" })
  }

  const pact = character.getPactSlots()
  if (pact && pact.current > 0 && pact.level >= spell.slotLevel) {
    choices.push({ level: pact.level as MagicCircleLevel, pool: "pact" })
  }

  return choices.sort((left, right) => left.level - right.level || (left.pool === "normal" ? -1 : 1))
}

function ResourcePill({ label, current, max, accent = false }: { label: string; current: number; max: number; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-2.5 py-2 text-xs", accent ? "border-accentBorder bg-accentBg" : "border-border bg-bg-subtle")}>
      <span className="font-semibold text-textH">{label}</span>{" "}
      <span className="text-textMuted">{current}/{max}</span>
    </div>
  )
}

function spellName(spell: Spell): string {
  return spell.displayName || spell.name
}

function sourceLabel(source: SpellSource): string {
  if (source.type === "class") {
    return CLASS_NAMES[source.name as keyof typeof CLASS_NAMES] ?? source.name ?? "Classe"
  }
  return source.name || (source.type === "equipment" ? "Equipamento" : source.type === "race" ? "Raça" : source.type === "feat" ? "Talento" : "Habilidade")
}

function actionFilterLabel(filter: ActionFilter): string {
  if (filter === "bonusAction") return "Ação bônus"
  if (filter === "reaction") return "Reação"
  if (filter === "other") return "Outro tempo"
  return "Ação"
}
