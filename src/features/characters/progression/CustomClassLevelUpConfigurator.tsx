import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { Ability } from "../../../models/abilities/Ability"
import {
  getCharacterAsis,
  withCharacterAsis,
  type CharacterAsi,
} from "../../../models/characters/CharacterAsi"
import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  CUSTOM_CLASS_RUNTIME_ID,
  getCustomClassConfig,
  getCustomClassIndex,
  type CustomClassRuntimeConfig,
} from "../../../models/characters/customClassConfig"
import {
  applyCustomClassLevelUp,
  getCustomLevelUpConfig,
} from "../../../models/characters/customClassProgression"
import { isAsiLevel } from "../../../rules/AsiRules"
import { AbilityDialog } from "../abilities/abilityDialog"
import { CustomClassConfigurationEditor } from "../characterSheet/classes/CustomClassConfigurationTab"
import { AsiSelectionModal } from "./AsiSelectionModal"

type HpMode = "average" | "manual" | "rolled"

type Props = {
  character: CharacterTemplate
  onBack: () => void
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

export function CustomClassLevelUpConfigurator({
  character,
  onBack,
  onCancel,
  onComplete,
}: Props) {
  const existingIndex = getCustomClassIndex(character)
  const existingEntry =
    existingIndex >= 0 ? character.get("sheet").classes?.[existingIndex] : undefined
  const previousLevel = existingEntry?.level ?? 0
  const targetLevel = Math.min(20, previousLevel + 1)
  const existingConfig = getCustomClassConfig(character)
  const [config, setConfig] = useState<CustomClassRuntimeConfig>(() =>
    getCustomLevelUpConfig(character),
  )
  const [hpMode, setHpMode] = useState<HpMode>("average")
  const [manualHp, setManualHp] = useState("")
  const [rolledDie, setRolledDie] = useState<number | null>(null)
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [abilityDialogOpen, setAbilityDialogOpen] = useState(false)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [asiModalOpen, setAsiModalOpen] = useState(false)
  const [asiChoice, setAsiChoice] = useState<CharacterAsi | null>(() =>
    getCharacterAsis(character).find(
      (entry) =>
        String(entry.className) === String(CUSTOM_CLASS_RUNTIME_ID) &&
        entry.classLevel === targetLevel,
    ) ?? null,
  )

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
  const asiEligible = isAsiLevel(CUSTOM_CLASS_RUNTIME_ID, targetLevel)
  const configDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(existingConfig ?? getCustomLevelUpConfig(character)),
    [character, config, existingConfig],
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

  function confirm() {
    if (previousLevel >= 20) return

    let updated = applyCustomClassLevelUp(
      character,
      config,
      hpGain,
      abilities,
    )

    if (asiEligible && asiChoice) {
      const eventId = crypto.randomUUID()
      const addedAt = new Date().toISOString()
      const totalLevel = (updated.get("sheet").classes ?? []).reduce(
        (sum, entry) => sum + entry.level,
        0,
      )
      const nextAsi: CharacterAsi = {
        ...asiChoice,
        className: CUSTOM_CLASS_RUNTIME_ID,
        classLevel: targetLevel,
        acquisition: createCharacterAcquisition({
          eventId,
          addedAt,
          reason: "level-up",
          characterLevel: totalLevel,
          className: CUSTOM_CLASS_RUNTIME_ID,
          classLevel: targetLevel,
          sourceType: "class",
          sourceId: String(CUSTOM_CLASS_RUNTIME_ID),
          sourceName: config.name,
        }),
      }
      updated = withCharacterAsis(updated, [
        ...getCharacterAsis(updated).filter(
          (entry) =>
            !(
              String(entry.className) === String(CUSTOM_CLASS_RUNTIME_ID) &&
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
            {previousLevel > 0
              ? `Subir ${config.name} de nível`
              : "Adicionar classe personalizada"}
          </h1>
          <p className="mt-1 text-xs text-textMuted">
            {previousLevel > 0
              ? `${config.name} ${previousLevel} → ${targetLevel}`
              : `${config.name} 1 · nova multiclasse`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onBack}>
            Escolher outra classe
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </header>

      <CustomClassConfigurationEditor
        config={config}
        applyLabel={configDirty ? "Aplicar configuração" : "Configuração aplicada"}
        onApply={setConfig}
      />

      <section className="rounded-xl border border-border bg-bg-subtle p-4">
        <h2 className="font-semibold text-textH">Pontos de vida</h2>
        <p className="mt-1 text-xs text-textMuted">
          Usa o dado de vida configurado da classe ({config.hitDie}).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={hpMode === "average" ? "primary" : "secondary"}
            onClick={() => setHpMode("average")}
          >
            Média (+{averageHp})
          </Button>
          <Button
            size="sm"
            variant={hpMode === "manual" ? "primary" : "secondary"}
            onClick={() => setHpMode("manual")}
          >
            Manual
          </Button>
          <Button
            size="sm"
            variant={hpMode === "rolled" ? "primary" : "secondary"}
            onClick={() => {
              setRolledDie(Math.floor(Math.random() * hitDieSides) + 1)
              setHpMode("rolled")
            }}
          >
            Rolar {config.hitDie}
          </Button>
        </div>
        {hpMode === "manual" ? (
          <Input
            className="mt-3 max-w-40"
            type="number"
            min={1}
            value={manualHp}
            onChange={(event) => setManualHp(event.target.value)}
          />
        ) : null}
        <div className="mt-3 text-xs text-textMuted">+{hpGain} PV</div>
      </section>

      <section className="rounded-xl border border-border bg-bg-subtle p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-textH">Características deste nível</h2>
            <p className="mt-1 text-xs text-textMuted">
              Cadastre somente as características obtidas nesta subida.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setEditingAbility(null)
              setAbilityDialogOpen(true)
            }}
          >
            Adicionar característica
          </Button>
        </div>

        {abilities.length ? (
          <div className="mt-3 grid gap-2">
            {abilities.map((ability) => (
              <article
                key={ability.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-textH">{ability.name}</div>
                  {ability.description?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-xs text-textMuted">
                      {ability.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingAbility(ability)
                      setAbilityDialogOpen(true)
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAbilities((current) =>
                        current.filter((entry) => entry.id !== ability.id),
                      )
                    }
                  >
                    Remover
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {asiEligible ? (
        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-textH">ASI / talento</h2>
              <p className="mt-1 text-xs text-textMuted">
                O nível {targetLevel} usa a progressão padrão de ASI da classe personalizada.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setAsiModalOpen(true)}>
              {asiChoice ? "Editar ASI" : "Configurar ASI"}
            </Button>
          </div>
        </section>
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button disabled={previousLevel >= 20} onClick={confirm}>
          {previousLevel >= 20
            ? "Classe já está no nível 20"
            : previousLevel > 0
              ? `Confirmar ${config.name} ${targetLevel}`
              : `Adicionar ${config.name}`}
        </Button>
      </footer>

      <AbilityDialog
        open={abilityDialogOpen}
        ability={editingAbility}
        onClose={() => {
          setAbilityDialogOpen(false)
          setEditingAbility(null)
        }}
        onSave={saveAbility}
      />

      <AsiSelectionModal
        open={asiModalOpen}
        value={asiChoice}
        className={CUSTOM_CLASS_RUNTIME_ID}
        classLevel={targetLevel}
        onChange={setAsiChoice}
        onClose={() => setAsiModalOpen(false)}
      />
    </section>
  )
}
