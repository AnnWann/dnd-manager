from pathlib import Path


def replace_once(path: Path, old: str, new: str):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {old[:180]!r}")
    path.write_text(text.replace(old, new, 1))


Path('src/features/characters/progression/CustomAwareLevelUpProgressionConfigurator.tsx').write_text(r'''import { useEffect, useRef, useState } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  createCustomClassRuntimeId,
  getCustomClassConfigFromEntry,
  isCustomClassEntry,
  isCustomClassName,
} from "../../../models/characters/customClassConfig"
import type { ClassName } from "../../../models/sheet/Class"
import { CustomClassLevelUpConfigurator } from "./CustomClassLevelUpConfigurator"
import { LevelUpProgressionConfigurator } from "./LevelUpProgressionConfigurator"

const NEW_CUSTOM_LEVEL_UP_OPTION = "__dnd_new_custom_class__"

type Props = {
  character: CharacterTemplate
  primaryClassName?: ClassName
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

export function CustomAwareLevelUpProgressionConfigurator({
  character,
  primaryClassName,
  onCancel,
  onComplete,
}: Props) {
  const initialClass =
    primaryClassName ?? character.get("sheet").classes?.[0]?.className
  const [customClassName, setCustomClassName] = useState<ClassName | null>(() =>
    isCustomClassName(initialClass) ? (initialClass as ClassName) : null,
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const customEntries = (character.get("sheet").classes ?? []).filter(isCustomClassEntry)
  const totalLevel = (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + entry.level,
    0,
  )
  const customSignature = customEntries
    .map((entry) => {
      const config = getCustomClassConfigFromEntry(entry)
      return `${String(entry.className)}:${entry.level}:${config?.name ?? ""}`
    })
    .join("|")

  useEffect(() => {
    if (customClassName) return
    const root = containerRef.current
    if (!root) return

    let frame = 0
    let observer: MutationObserver | undefined

    const sync = () => {
      const label = Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find(
        (entry) => entry.textContent?.trim().startsWith("Classe que recebe o nível"),
      )
      const select = label?.querySelector<HTMLSelectElement>("select")
      if (!select) return

      for (const candidate of Array.from(select.options)) {
        if (candidate.dataset.dndCustomLevelUpOption === "true") continue
        const current = candidate.textContent ?? ""
        const next = current
          .replace(/\s*·\s*(?:consulte sua refer[eê]ncia|requisitos manuais)\s*$/iu, "")
          .replace(/\s*·\s*$/u, "")
          .trim()
        if (next !== current) candidate.textContent = next
      }

      const desired = new Map<string, { label: string; disabled: boolean }>()
      for (const entry of customEntries) {
        const config = getCustomClassConfigFromEntry(entry)
        desired.set(String(entry.className), {
          label: `${config?.name?.trim() || "Classe personalizada"} ${entry.level} → ${entry.level + 1}`,
          disabled: entry.level >= 20 || totalLevel >= 20,
        })
      }
      desired.set(NEW_CUSTOM_LEVEL_UP_OPTION, {
        label: "Nova classe personalizada 1 (multiclasse)",
        disabled: totalLevel >= 20,
      })

      for (const option of Array.from(select.options)) {
        if (option.dataset.dndCustomLevelUpOption !== "true") continue
        if (!desired.has(option.value)) option.remove()
      }

      for (const [value, definition] of desired) {
        let option = Array.from(select.options).find(
          (candidate) =>
            candidate.dataset.dndCustomLevelUpOption === "true" &&
            candidate.value === value,
        )
        if (!option) {
          option = document.createElement("option")
          option.value = value
          option.dataset.dndCustomLevelUpOption = "true"
          select.appendChild(option)
        }
        if (option.textContent !== definition.label) option.textContent = definition.label
        if (option.disabled !== definition.disabled) option.disabled = definition.disabled
      }
    }

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        sync()
      })
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0
      sync()
      observer = new MutationObserver(scheduleSync)
      observer.observe(root, { childList: true, subtree: true })
    })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [customClassName, customSignature, totalLevel])

  if (customClassName) {
    return (
      <CustomClassLevelUpConfigurator
        key={String(customClassName)}
        character={character}
        className={customClassName}
        onBack={() => setCustomClassName(null)}
        onCancel={onCancel}
        onComplete={onComplete}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      onChangeCapture={(event) => {
        const target = event.target
        if (!(target instanceof HTMLSelectElement)) return

        if (target.value === NEW_CUSTOM_LEVEL_UP_OPTION) {
          event.stopPropagation()
          setCustomClassName(createCustomClassRuntimeId())
          return
        }

        if (isCustomClassName(target.value)) {
          event.stopPropagation()
          setCustomClassName(target.value as ClassName)
        }
      }}
    >
      <LevelUpProgressionConfigurator
        character={character}
        primaryClassName={primaryClassName}
        onCancel={onCancel}
        onComplete={onComplete}
      />
    </div>
  )
}
''')


Path('src/features/characters/progression/CustomClassLevelUpConfigurator.tsx').write_text(r'''import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Ability } from "../../../models/abilities/Ability"
import {
  getCharacterAsis,
  withCharacterAsis,
  type CharacterAsi,
} from "../../../models/characters/CharacterAsi"
import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { applyManualProficiencies } from "../../../models/characters/applyManualProficiencies"
import {
  createCustomClassEntry,
  getCustomClassConfig,
  getCustomClassIndex,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../models/characters/customClassConfig"
import {
  applyCustomClassLevelUp,
  applyCustomClassSpellSelection,
  getCustomLevelUpConfig,
} from "../../../models/characters/customClassProgression"
import { getClassSpellSelectionRule } from "../../../models/leveling/SpellSelectionRules"
import type { ClassLevel, ClassName } from "../../../models/sheet/Class"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import { AbilityDialog } from "../abilities/abilityDialog"
import { CustomClassConfigurationEditor } from "../characterSheet/classes/CustomClassConfigurationTab"
import { ProficiencySelectionModal } from "../proficiencies/ProficiencySelectionModal"
import { AsiSelectionModal } from "./AsiSelectionModal"
import {
  LevelUpSpellSelectionModal,
  type LevelUpSpellSelection,
  type LevelUpSpellSelectionKind,
} from "./LevelUpSpellSelectionModal"

type HpMode = "average" | "manual" | "rolled"

type Props = {
  character: CharacterTemplate
  className: ClassName
  onBack: () => void
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

export function CustomClassLevelUpConfigurator({
  character,
  className,
  onBack,
  onCancel,
  onComplete,
}: Props) {
  const { spells } = useMagicContext()
  const existingIndex = getCustomClassIndex(character, className)
  const existingEntry =
    existingIndex >= 0 ? character.get("sheet").classes?.[existingIndex] : undefined
  const previousLevel = existingEntry?.level ?? 0
  const targetLevel = Math.min(20, previousLevel + 1)
  const totalLevel = (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + entry.level,
    0,
  )
  const cannotLevel = previousLevel >= 20 || totalLevel >= 20
  const existingConfig = getCustomClassConfig(character, className)
  const [config, setConfig] = useState<CustomClassRuntimeConfig>(() =>
    getCustomLevelUpConfig(character, className),
  )
  const [configurationOpen, setConfigurationOpen] = useState(!existingEntry)
  const [hpMode, setHpMode] = useState<HpMode>("average")
  const [manualHp, setManualHp] = useState("")
  const [rolledDie, setRolledDie] = useState<number | null>(null)
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [abilityDialogOpen, setAbilityDialogOpen] = useState(false)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [proficiencies, setProficiencies] = useState<Proficiency[]>([])
  const [proficiencyModalOpen, setProficiencyModalOpen] = useState(false)
  const [spellModalKind, setSpellModalKind] =
    useState<LevelUpSpellSelectionKind | null>(null)
  const [spellSelectionTouched, setSpellSelectionTouched] = useState(false)
  const [spellSelection, setSpellSelection] = useState<LevelUpSpellSelection>(() =>
    getCurrentCustomSpellSelection(character, className),
  )
  const [asiModalOpen, setAsiModalOpen] = useState(false)
  const [asiChoice, setAsiChoice] = useState<CharacterAsi | null>(() =>
    getCharacterAsis(character).find(
      (entry) =>
        String(entry.className) === String(className) &&
        entry.classLevel === targetLevel,
    ) ?? null,
  )

  const previewCharacter = useMemo(() => {
    const classes = [...(character.get("sheet").classes ?? [])]
    const index = classes.findIndex(
      (entry) => String(entry.className) === String(className),
    )
    if (index >= 0) {
      classes[index] = {
        ...classes[index],
        level: targetLevel as ClassLevel,
      }
    } else {
      classes.push({
        ...createCustomClassEntry(config.name, className),
        level: targetLevel as ClassLevel,
      })
    }
    return updateCustomClassConfig(
      character.withSheet("classes", classes),
      config,
      className,
    )
  }, [character, className, config, targetLevel])

  const currentSpellRule = getClassSpellSelectionRule(
    previewCharacter,
    className,
    targetLevel,
  )
  const previousSpellRule = previousLevel > 0
    ? getClassSpellSelectionRule(previewCharacter, className, previousLevel)
    : undefined
  const previousCantrips = previousSpellRule?.maxCantrips ?? 0
  const currentCantrips = currentSpellRule.maxCantrips
  const previousLeveled = previousSpellRule?.maxLeveledSpells ?? 0
  const currentLeveled = currentSpellRule.maxLeveledSpells
  const canManageCantrips = previousCantrips > 0 || currentCantrips > 0
  const canManageLeveled =
    config.knownSpellMode !== "prepared-only" &&
    (previousLeveled > 0 || currentLeveled > 0)

  const hitDieSides = Number(config.hitDie.slice(1)) || 8
  const conModifier = character.getAttributeModifier("con")
  const averageDie = Math.floor(hitDieSides / 2) + 1
  const averageHp = Math.max(1, averageDie + conModifier)
  const hpGain =
    hpMode === "manual"
      ? Math.max(1, Math.trunc(Number(manualHp) || 1))
      : hpMode === "rolled"
        ? Math.max(1, (rolledDie ?? averageDie) + conModifier)
        : averageHp
  const asiEligible = config.asiLevels.includes(targetLevel)
  const configDirty = useMemo(
    () =>
      JSON.stringify(config) !==
      JSON.stringify(existingConfig ?? getCustomLevelUpConfig(character, className)),
    [character, className, config, existingConfig],
  )

  function saveAbility(ability: Ability) {
    const normalized: Ability = {
      ...ability,
      source: "class",
      category: ability.category === "feat" ? "general" : ability.category,
    }
    setAbilities((current) => {
      const exists = current.some((entry) => entry.id === normalized.id)
      return exists
        ? current.map((entry) => (entry.id === normalized.id ? normalized : entry))
        : [...current, normalized]
    })
    setAbilityDialogOpen(false)
    setEditingAbility(null)
  }

  function updateSpellSelection(next: LevelUpSpellSelection) {
    setSpellSelection(next)
    setSpellSelectionTouched(true)
  }

  function confirm() {
    if (cannotLevel) return

    const eventId = crypto.randomUUID()
    const addedAt = new Date().toISOString()
    let updated = applyCustomClassLevelUp(
      character,
      className,
      config,
      hpGain,
      abilities,
      eventId,
      addedAt,
    )

    updated = applyManualProficiencies(updated, proficiencies)

    if (spellSelectionTouched) {
      updated = applyCustomClassSpellSelection(
        updated,
        className,
        config,
        targetLevel,
        spellSelection.selected,
        spellSelection.prepared,
        spells,
        eventId,
        addedAt,
      )
    }

    if (asiEligible && asiChoice) {
      const nextTotalLevel = (updated.get("sheet").classes ?? []).reduce(
        (sum, entry) => sum + entry.level,
        0,
      )
      const nextAsi: CharacterAsi = {
        ...asiChoice,
        className,
        classLevel: targetLevel,
        acquisition: createCharacterAcquisition({
          eventId,
          addedAt,
          reason: "level-up",
          characterLevel: nextTotalLevel,
          className,
          classLevel: targetLevel,
          sourceType: "class",
          sourceId: String(className),
          sourceName: config.name,
        }),
      }
      updated = withCharacterAsis(updated, [
        ...getCharacterAsis(updated).filter(
          (entry) =>
            !(
              String(entry.className) === String(className) &&
              entry.classLevel === targetLevel
            ),
        ),
        nextAsi,
      ])
    }

    onComplete(updated)
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-lg font-semibold text-textH">
            {previousLevel > 0 ? `Subir ${config.name} de nível` : "Adicionar classe personalizada"}
          </h1>
          <p className="mt-1 text-xs text-textMuted">
            {previousLevel > 0 ? `${config.name} ${previousLevel} → ${targetLevel}` : `${config.name} 1 · nova multiclasse`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onBack}>Escolher outra classe</Button>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-bg-subtle p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-textH">Configuração permanente da classe</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
              Define como esta classe funciona em todos os níveis. Alterar esta seção não significa que o personagem recebe algo agora; os ganhos desta subida ficam separados abaixo.
            </p>
            <div className="mt-2 text-xs text-textMuted">
              {config.name} · {config.hitDie} · {config.casterType === "none" ? "não conjurador" : "conjurador"}{configDirty ? " · alterações pendentes" : ""}
            </div>
          </div>
          <Button variant="secondary" onClick={() => setConfigurationOpen((current) => !current)}>
            {configurationOpen ? "Fechar configuração" : "Editar configuração"}
          </Button>
        </div>
        {configurationOpen ? (
          <div className="mt-4">
            <CustomClassConfigurationEditor config={config} applyLabel="Aplicar ao level up" onApply={setConfig} />
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 rounded-xl border border-accentBorder bg-accentBg/20 p-4">
        <div>
          <h2 className="text-base font-semibold text-textH">Ganhos deste nível</h2>
          <p className="mt-1 text-xs text-textMuted">Somente o que o personagem recebe ao alcançar o nível {targetLevel} de {config.name}.</p>
        </div>

        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="font-semibold text-textH">Pontos de vida</h3>
          <p className="mt-1 text-xs text-textMuted">Usa o dado de vida da configuração permanente ({config.hitDie}).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={hpMode === "average" ? "primary" : "secondary"} onClick={() => setHpMode("average")}>Média (+{averageHp})</Button>
            <Button size="sm" variant={hpMode === "manual" ? "primary" : "secondary"} onClick={() => setHpMode("manual")}>Manual</Button>
            <Button size="sm" variant={hpMode === "rolled" ? "primary" : "secondary"} onClick={() => { setRolledDie(Math.floor(Math.random() * hitDieSides) + 1); setHpMode("rolled") }}>Rolar {config.hitDie}</Button>
          </div>
          {hpMode === "manual" ? <Input className="mt-3 max-w-40" type="number" min={1} value={manualHp} onChange={(event) => setManualHp(event.target.value)} /> : null}
          <div className="mt-3 text-xs text-textMuted">+{hpGain} PV</div>
        </section>

        <section className="rounded-xl border border-border bg-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold text-textH">Características deste nível</h3><p className="mt-1 text-xs text-textMuted">Cadastre somente as características recebidas nesta subida.</p></div>
            <Button variant="secondary" onClick={() => { setEditingAbility(null); setAbilityDialogOpen(true) }}>Adicionar característica</Button>
          </div>
          {abilities.length ? <div className="mt-3 grid gap-2">{abilities.map((ability) => <article key={ability.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3"><div className="min-w-0"><div className="font-medium text-textH">{ability.name}</div>{ability.description?.trim() ? <p className="mt-1 line-clamp-2 text-xs text-textMuted">{ability.description}</p> : null}</div><div className="flex shrink-0 gap-2"><Button size="sm" variant="ghost" onClick={() => { setEditingAbility(ability); setAbilityDialogOpen(true) }}>Editar</Button><Button size="sm" variant="ghost" onClick={() => setAbilities((current) => current.filter((entry) => entry.id !== ability.id))}>Remover</Button></div></article>)}</div> : <div className="mt-3 text-xs text-textMuted">Nenhuma característica adicionada.</div>}
        </section>

        <section className="rounded-xl border border-border bg-bg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold text-textH">Proficiências deste nível</h3><p className="mt-1 text-xs text-textMuted">Adicione apenas perícias, expertise, armas, ferramentas ou outras proficiências concedidas por este nível.</p><div className="mt-2 text-xs text-textMuted">{proficiencies.length} adicionada(s)</div></div>
            <Button variant="secondary" onClick={() => setProficiencyModalOpen(true)}>{proficiencies.length ? "Editar proficiências" : "Adicionar proficiência"}</Button>
          </div>
        </section>

        {config.casterType !== "none" ? (
          <section className="rounded-xl border border-border bg-bg p-4">
            <div><h3 className="font-semibold text-textH">Magia neste nível</h3><p className="mt-1 text-xs text-textMuted">Os limites vêm da configuração permanente da classe. Os espaços de magia são atualizados automaticamente ao confirmar.</p></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {canManageCantrips ? <GainCard title="Truques conhecidos" value={`${previousCantrips} → ${currentCantrips}`} action="Escolher truques" onClick={() => setSpellModalKind("cantrip")} /> : null}
              {canManageLeveled ? <GainCard title={config.knownSpellMode === "spellbook" ? "Magias no grimório" : "Magias conhecidas"} value={`${previousLeveled} → ${currentLeveled}`} action={config.knownSpellMode === "spellbook" ? "Atualizar grimório" : "Escolher magias"} onClick={() => setSpellModalKind("leveled")} /> : null}
              {!canManageCantrips && !canManageLeveled ? <div className="rounded-lg border border-dashed border-border p-4 text-xs text-textMuted sm:col-span-2">Nenhuma seleção de magia é concedida neste nível.</div> : null}
            </div>
          </section>
        ) : null}

        {asiEligible ? (
          <section className="rounded-xl border border-border bg-bg p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-textH">ASI / talento</h3><p className="mt-1 text-xs text-textMuted">O nível {targetLevel} foi marcado como nível de ASI na configuração permanente desta classe.</p></div><Button variant="secondary" onClick={() => setAsiModalOpen(true)}>{asiChoice ? "Editar ASI" : "Configurar ASI"}</Button></div>
          </section>
        ) : null}
      </div>

      {cannotLevel ? <div className="rounded-xl border border-danger bg-dangerBg p-3 text-xs text-danger">O personagem ou esta classe já atingiu o limite de nível permitido.</div> : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack}>Voltar</Button>
        <Button disabled={cannotLevel} onClick={confirm}>{cannotLevel ? "Limite de nível atingido" : previousLevel > 0 ? `Confirmar ${config.name} ${targetLevel}` : `Adicionar ${config.name}`}</Button>
      </footer>

      <AbilityDialog open={abilityDialogOpen} ability={editingAbility} onClose={() => { setAbilityDialogOpen(false); setEditingAbility(null) }} onSave={saveAbility} />
      <ProficiencySelectionModal open={proficiencyModalOpen} proficiencies={proficiencies} onChange={setProficiencies} onClose={() => setProficiencyModalOpen(false)} title={`Proficiências recebidas — ${config.name} ${targetLevel}`} description="Estas proficiências pertencem somente a esta subida de nível; elas não alteram a definição permanente da classe." />
      <LevelUpSpellSelectionModal open={spellModalKind !== null} kind={spellModalKind ?? "leveled"} character={previewCharacter} className={className} previousLevel={previousLevel} targetLevel={targetLevel} spells={spells} selection={spellSelection} onChange={updateSpellSelection} onClose={() => setSpellModalKind(null)} />
      <AsiSelectionModal open={asiModalOpen} value={asiChoice} className={className} classLevel={targetLevel} onChange={setAsiChoice} onClose={() => setAsiModalOpen(false)} />
    </section>
  )
}

function GainCard({ title, value, action, onClick }: { title: string; value: string; action: string; onClick: () => void }) {
  return <div className="rounded-xl border border-border bg-bg-subtle p-3"><div className="text-xs font-semibold text-textH">{title}</div><div className="mt-1 text-xs text-textMuted">{value}</div><Button className="mt-3 w-full" size="sm" variant="secondary" onClick={onClick}>{action}</Button></div>
}

function getCurrentCustomSpellSelection(character: CharacterTemplate, className: ClassName): LevelUpSpellSelection {
  const known = (character.get("magic")?.spells.knownSpells ?? []).filter(
    (entry) => entry.source.type === "class" && String(entry.source.sourceId ?? entry.source.name) === String(className),
  )
  return {
    selected: Array.from(new Set(known.map((entry) => entry.spells.id))),
    prepared: Array.from(new Set(known.filter((entry) => entry.spells.prepared).map((entry) => entry.spells.id))),
  }
}
''')


path = Path('src/models/characters/customClassProgression.ts')
text = path.read_text()
text = text.replace('import type { Ability } from "../abilities/Ability"\n', 'import type { Ability } from "../abilities/Ability"\nimport type { Spell } from "../magic/spells/Spell"\n', 1)
text = text.replace('  CUSTOM_CLASS_RUNTIME_ID,\n', '', 1)
start = text.index('export function applyCustomClassLevelUp(')
end = text.index('\nfunction recalculateCreationHp(', start)
replacement = r'''export function applyCustomClassLevelUp(
  character: CharacterTemplate,
  className: ClassName,
  config: CustomClassRuntimeConfig,
  hpGain: number,
  abilities: Ability[] = [],
  eventId = crypto.randomUUID(),
  addedAt = new Date().toISOString(),
): CharacterTemplate {
  const normalized = normalizeCustomClassConfig(config)
  const classes = [...(character.get("sheet").classes ?? [])]
  const customIndex = getCustomClassIndex(character, className)
  const previousCustomLevel = customIndex >= 0 ? classes[customIndex].level : 0
  const targetLevel = Math.min(20, previousCustomLevel + 1)
  if (previousCustomLevel >= 20) return character

  if (customIndex >= 0) {
    classes[customIndex] = { ...classes[customIndex], level: targetLevel as ClassLevel }
  } else {
    classes.push({ ...createCustomClassEntry(normalized.name, className), level: 1 })
  }

  let next = character.withSheet("classes", classes)
  next = updateCustomClassConfig(next, normalized, className)
  next = addCustomLevelHp(next, normalized, hpGain)

  if (abilities.length) {
    const totalLevel = (next.get("sheet").classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
    const stamped = abilities.map((ability) => ({
      ...ability,
      source: "class" as const,
      acquisition: createCharacterAcquisition({
        eventId,
        addedAt,
        reason: "level-up",
        characterLevel: totalLevel,
        className,
        classLevel: targetLevel,
        sourceType: "class",
        sourceId: String(className),
        sourceName: normalized.name,
      }),
    }))
    const stampedIds = new Set(stamped.map((ability) => ability.id))
    next = next.with("abilities", [
      ...(next.get("abilities") ?? []).filter((ability) => !stampedIds.has(ability.id)),
      ...stamped,
    ])
  }

  return next.syncMagicWithClasses()
}

export function applyCustomClassSpellSelection(
  character: CharacterTemplate,
  className: ClassName,
  config: CustomClassRuntimeConfig,
  targetLevel: number,
  spellIndexes: string[],
  preparedSpellIndexes: string[],
  spells: Spell[],
  eventId = crypto.randomUUID(),
  addedAt = new Date().toISOString(),
): CharacterTemplate {
  const normalized = normalizeCustomClassConfig(config)
  const ensured = character.ensureMagic()
  const magic = ensured.get("magic")
  if (!magic) return ensured

  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  const matchesClass = (entry: typeof magic.spells.knownSpells[number]) =>
    entry.source.type === "class" &&
    String(entry.source.sourceId ?? entry.source.name) === String(className)
  const existingForClass = new Map(
    magic.spells.knownSpells.filter(matchesClass).map((entry) => [entry.spells.id, entry]),
  )
  const preparedOnly = normalized.knownSpellMode === "prepared-only"
  const retained = magic.spells.knownSpells.filter((entry) => {
    if (!matchesClass(entry)) return true
    if (!preparedOnly) return false
    const spell = byIndex.get(entry.spells.id)
    return !spell || spell.slotLevel > 0
  })
  const totalLevel = (ensured.get("sheet").classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
  const acquisition = createCharacterAcquisition({
    eventId,
    addedAt,
    reason: "level-up",
    characterLevel: totalLevel,
    className,
    classLevel: targetLevel,
    sourceType: "class",
    sourceId: String(className),
    sourceName: normalized.name,
  })
  const additions = [] as typeof magic.spells.knownSpells

  for (const spellIndex of Array.from(new Set(spellIndexes))) {
    const spell = byIndex.get(spellIndex)
    if (!spell) continue
    if (preparedOnly && spell.slotLevel > 0) continue
    const existing = existingForClass.get(spellIndex)
    additions.push({
      source: {
        ...(existing?.source ?? {}),
        type: "class",
        name: normalized.name,
        sourceId: String(className),
        attribute: normalized.castingAttribute,
        extendedList: existing?.source.extendedList ?? false,
      },
      spells: {
        ...existing?.spells,
        id: spellIndex,
        prepared: preparedOnly && spell.slotLevel === 0
          ? true
          : existing?.spells.prepared ?? preparedSpellIndexes.includes(spellIndex),
      },
      acquisition: existing?.acquisition ?? acquisition,
    })
  }

  const byKey = new Map<string, typeof magic.spells.knownSpells[number]>()
  for (const entry of [...retained, ...additions]) {
    byKey.set(`${entry.source.type}:${entry.source.sourceId ?? entry.source.name}:${entry.spells.id}`, entry)
  }

  return ensured.with("magic", {
    ...magic,
    spells: { ...magic.spells, knownSpells: Array.from(byKey.values()) },
  }).syncMagicWithClasses()
}

export function getCustomLevelUpConfig(
  character: CharacterTemplate,
  className?: ClassName,
): CustomClassRuntimeConfig {
  return normalizeCustomClassConfig(getCustomClassConfig(character, className))
}
'''
path.write_text(text[:start] + replacement + text[end:])


path = Path('src/features/characters/progression/LevelUpSpellSelectionModal.tsx')
replace_once(path,
'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\n',
'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\nimport { getCustomClassConfig, isCustomClassName } from "../../../models/characters/customClassConfig"\n')
replace_once(path,
'''  const canUseModal =
    kind === "cantrip"
      ? rule.mode !== "none" && rule.maxCantrips > 0
      : rule.mode === "limited-known" || rule.mode === "spellbook"
''',
'''  const customClass = isCustomClassName(className)
  const customConfig = customClass ? getCustomClassConfig(character, className) : undefined
  const classLabel = customClass
    ? customConfig?.name?.trim() || "Classe personalizada"
    : CLASS_NAMES[className]
  const previousCantrips = previousLevel <= 0 ? 0 : previousRule.maxCantrips
  const previousLeveled = previousLevel <= 0 ? 0 : previousRule.maxLeveledSpells
  const searchableMaxSpellLevel = Math.max(
    Number(rule.maxSpellLevel),
    previousLevel <= 0 ? 0 : Number(previousRule.maxSpellLevel),
  )
  const canUseModal = customClass
    ? kind === "cantrip"
      ? rule.maxCantrips > 0 || previousCantrips > 0
      : customConfig?.knownSpellMode !== "prepared-only" &&
        (rule.maxLeveledSpells > 0 || previousLeveled > 0)
    : kind === "cantrip"
      ? rule.mode !== "none" && rule.maxCantrips > 0
      : rule.mode === "limited-known" || rule.mode === "spellbook"
  const currentClassSpellIndexes = useMemo(
    () =>
      new Set(
        (character.get("magic")?.spells.knownSpells ?? [])
          .filter(
            (entry) =>
              entry.source.type === "class" &&
              resolveSourceClass(entry.source.sourceId, entry.source.name) === className,
          )
          .map((entry) => entry.spells.id),
      ),
    [character, className],
  )
''')
replace_once(path,
'''      queryOfficialSpellDetails({
        className,
        maxLevel: Number(rule.maxSpellLevel),
        page: 1,
        pageSize: 250,
      }),
''',
'''      queryOfficialSpellDetails({
        className: customClass ? undefined : className,
        maxLevel: searchableMaxSpellLevel,
        page: 1,
        pageSize: customClass ? 1000 : 250,
      }),
''')
replace_once(path,
'  }, [canUseModal, className, ensureOfficialSpells, open, rule.maxSpellLevel, selection.selected])\n',
'  }, [canUseModal, className, customClass, ensureOfficialSpells, open, searchableMaxSpellLevel, selection.selected])\n')
replace_once(path,
'''  const availableSpells = useMemo(() => {
    const homebrew = spells.filter(
      (spell) => spell.homebrew && spell.classes.includes(className),
    )
    const byIndex = new Map<string, Spell>()
    for (const spell of officialSpells) byIndex.set(spell.index, spell)
    for (const spell of homebrew) byIndex.set(spell.index, spell)
    return Array.from(byIndex.values()).filter((spell) =>
      isSpellAllowedForClassSelection(spell, rule, []),
    )
  }, [className, officialSpells, rule, spells])
''',
'''  const availableSpells = useMemo(() => {
    const localSpells = customClass
      ? spells
      : spells.filter(
          (spell) => spell.homebrew && spell.classes.includes(className),
        )
    const byIndex = new Map<string, Spell>()
    for (const spell of officialSpells) byIndex.set(spell.index, spell)
    for (const spell of localSpells) byIndex.set(spell.index, spell)
    return Array.from(byIndex.values()).filter(
      (spell) =>
        currentClassSpellIndexes.has(spell.index) ||
        isSpellAllowedForClassSelection(spell, rule, []),
    )
  }, [className, currentClassSpellIndexes, customClass, officialSpells, rule, spells])
''')
replace_once(path,
'  const replacementLimit = kind === "cantrip" ? rule.swap.cantrips : rule.swap.leveledKnown\n',
'  const replacementLimit = customClass\n    ? originalIndexes.length\n    : kind === "cantrip"\n      ? rule.swap.cantrips\n      : rule.swap.leveledKnown\n')
replace_once(path,
'  const title = getTitle(kind, rule.mode, className, gained, replacementLimit)\n',
'  const title = getTitle(kind, rule.mode, classLabel, gained, replacementLimit)\n')
replace_once(path,
'Somente opções da lista de {CLASS_NAMES[className]} são exibidas.',
'Somente opções disponíveis para {classLabel} são exibidas.')
replace_once(path,
'Nenhuma opção da lista de {CLASS_NAMES[className]} corresponde aos filtros.',
'Nenhuma opção disponível para {classLabel} corresponde aos filtros.')
replace_once(path,
'''function getTitle(kind: LevelUpSpellSelectionKind, mode: ReturnType<typeof getClassSpellSelectionRule>["mode"], className: ClassName, gained: number, replacementLimit: number): string {
  const classLabel = CLASS_NAMES[className]
''',
'''function getTitle(kind: LevelUpSpellSelectionKind, mode: ReturnType<typeof getClassSpellSelectionRule>["mode"], classLabel: string, gained: number, replacementLimit: number): string {
''')
