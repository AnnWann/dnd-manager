import { useMemo, useState } from "react"

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
