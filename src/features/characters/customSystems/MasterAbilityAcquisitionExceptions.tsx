import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Settings2, X } from "lucide-react"
import { useLocation } from "react-router-dom"

import { useCharacterContext } from "../../../contexts/characterContext"
import { useSyncContext } from "../../../contexts/syncContext"
import {
  getCustomAbilityAcquisitionException,
  getCustomAbilityLimit,
  setCustomAbilityAcquisitionException,
} from "../../../lib/customSystems"
import { useCustomSystemDefinitions } from "../../../lib/customSystems/CustomSystemRegistry"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  CharacterCustomSystemState,
  CustomAbilityAcquisitionExceptionState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../../models/customSystems/CustomSystemDefinition"
import type {
  CustomAbilityAcquisitionDefinition,
  CustomAbilityTypeDefinition,
} from "../../../models/customSystems/CustomAbilityDefinition"

type ExceptionDraft = CustomAbilityAcquisitionExceptionState

type EligibleType = {
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  type: CustomAbilityTypeDefinition
}

export function MasterAbilityAcquisitionExceptions() {
  const location = useLocation()
  const { userRole } = useSyncContext()
  const { activeCharacter, updateCharacter } = useCharacterContext()
  const definitions = useCustomSystemDefinitions()
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, ExceptionDraft>>({})

  const eligible = useMemo<EligibleType[]>(() => {
    if (!activeCharacter) return []
    const states = (activeCharacter.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]

    return states.flatMap((state) => {
      if (state.enabled === false) return []
      const definition = definitions.find((entry) => entry.id === state.systemId)
      if (!definition) return []

      return definition.abilityTypes
        .filter(hasConfigurableLimit)
        .map((type) => ({ definition, state, type }))
    })
  }, [activeCharacter, definitions])

  useEffect(() => {
    if (!open) return
    const next: Record<string, ExceptionDraft> = {}
    for (const entry of eligible) {
      next[keyFor(entry)] = cloneException(
        getCustomAbilityAcquisitionException(entry.state, entry.type.id),
      )
    }
    setDrafts(next)
  }, [eligible, open])

  if (
    userRole !== "master" ||
    !location.pathname.startsWith("/character") ||
    !activeCharacter ||
    eligible.length === 0
  ) {
    return null
  }

  function patch(entry: EligibleType, value: Partial<ExceptionDraft>) {
    const key = keyFor(entry)
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? {}), ...value },
    }))
  }

  function toggleId(
    entry: EligibleType,
    field: "alwaysLearnedAbilityIds" | "alwaysPreparedAbilityIds",
    abilityId: string,
    checked: boolean,
  ) {
    const current = drafts[keyFor(entry)] ?? {}
    const ids = new Set(current[field] ?? [])
    if (checked) ids.add(abilityId)
    else ids.delete(abilityId)

    const patchValue: Partial<ExceptionDraft> = { [field]: Array.from(ids) }
    if (field === "alwaysPreparedAbilityIds" && checked) {
      const learned = new Set(current.alwaysLearnedAbilityIds ?? [])
      learned.delete(abilityId)
      patchValue.alwaysLearnedAbilityIds = Array.from(learned)
    }
    patch(entry, patchValue)
  }

  function save() {
    if (!activeCharacter) return
    updateCharacter(activeCharacter.get("id"), (character) => {
      const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
      const nextStates = states.map((state) => {
        const definition = definitions.find((entry) => entry.id === state.systemId)
        if (!definition) return state

        let next = state
        for (const type of definition.abilityTypes.filter(hasConfigurableLimit)) {
          const value = drafts[`${definition.id}:${type.id}`]
          if (!value) continue
          next = setCustomAbilityAcquisitionException(next, type.id, value)
        }
        return next
      })
      return character.withSheet("customSystems", nextStates)
    })
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-xl border border-accentBorder bg-bg-elevated px-3 py-2.5 text-xs font-semibold text-textH shadow-theme-lg hover:bg-accentBg"
        title="Configurar exceções de aprendizagem e preparo"
      >
        <Settings2 className="h-4 w-4" />
        Exceções de preparo
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/65 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false)
          }}
        >
          <section className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-theme-lg sm:max-h-[90dvh]">
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-sm font-semibold text-textH">Exceções de aprendizagem e preparo</h2>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  Ajustes exclusivos deste personagem. Você pode substituir a fórmula do sistema e definir habilidades que não consomem o limite normal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-textMuted hover:bg-bg-subtle hover:text-textH"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="grid gap-4">
                {eligible.map((entry) => (
                  <ExceptionTypeCard
                    key={keyFor(entry)}
                    entry={entry}
                    character={activeCharacter}
                    draft={drafts[keyFor(entry)] ?? {}}
                    onPatch={(value) => patch(entry, value)}
                    onToggle={(field, abilityId, checked) =>
                      toggleId(entry, field, abilityId, checked)
                    }
                  />
                ))}
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-border p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-textH hover:bg-bg-subtle"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-lg border border-accent bg-accent px-4 py-2 text-xs font-semibold text-accentText"
              >
                Salvar exceções
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  )
}

function ExceptionTypeCard({
  entry,
  character,
  draft,
  onPatch,
  onToggle,
}: {
  entry: EligibleType
  character: CharacterTemplate
  draft: ExceptionDraft
  onPatch: (value: Partial<ExceptionDraft>) => void
  onToggle: (
    field: "alwaysLearnedAbilityIds" | "alwaysPreparedAbilityIds",
    abilityId: string,
    checked: boolean,
  ) => void
}) {
  const acquisition = entry.type.acquisition
  const learned = usesLearned(acquisition?.mode)
  const prepared = usesPrepared(acquisition?.mode)
  const previewState = withDraftException(entry.state, entry.type.id, draft)
  const learnedLimit = learned
    ? getCustomAbilityLimit(entry.definition, previewState, entry.type, "learned", character)
    : undefined
  const preparedLimit = prepared
    ? getCustomAbilityLimit(entry.definition, previewState, entry.type, "prepared", character)
    : undefined
  const abilities = entry.state.abilities.filter(
    (ability) => ability.abilityTypeId === entry.type.id,
  )
  const alwaysLearned = new Set(draft.alwaysLearnedAbilityIds ?? [])
  const alwaysPrepared = new Set(draft.alwaysPreparedAbilityIds ?? [])

  return (
    <article className="rounded-xl border border-border bg-bg p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-textH">{entry.type.name}</h3>
          <p className="mt-0.5 text-[11px] text-textMuted">{entry.definition.name}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-textMuted">
          {learnedLimit !== undefined ? <Badge>Aprendidas: {learnedLimit}</Badge> : null}
          {preparedLimit !== undefined ? <Badge>Preparadas: {preparedLimit}</Badge> : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        {learned ? (
          <FormulaOverrideControl
            label="Fórmula de aprendizagem deste personagem"
            original={acquisition?.learnedLimitFormula}
            value={draft.learnedLimitFormulaOverride ?? ""}
            onChange={(learnedLimitFormulaOverride) => onPatch({ learnedLimitFormulaOverride })}
          />
        ) : null}
        {prepared ? (
          <FormulaOverrideControl
            label="Fórmula de preparo deste personagem"
            original={acquisition?.preparedLimitFormula}
            value={draft.preparedLimitFormulaOverride ?? ""}
            onChange={(preparedLimitFormulaOverride) => onPatch({ preparedLimitFormulaOverride })}
          />
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {learned ? (
          <NumberControl
            label="Bônus no limite aprendido"
            value={draft.extraLearnedSlots ?? 0}
            onChange={(extraLearnedSlots) => onPatch({ extraLearnedSlots })}
          />
        ) : null}
        {prepared ? (
          <NumberControl
            label="Bônus no limite preparado"
            value={draft.extraPreparedSlots ?? 0}
            onChange={(extraPreparedSlots) => onPatch({ extraPreparedSlots })}
          />
        ) : null}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
          Habilidades que não consomem o limite
        </div>
        {!abilities.length ? (
          <p className="text-xs text-textMuted">
            Adicione as habilidades à ficha primeiro; depois elas poderão ser marcadas como exceção.
          </p>
        ) : (
          <div className="grid gap-2">
            {abilities.map((ability) => (
              <div
                key={ability.id}
                className="grid gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0 text-xs font-medium text-textH">
                  {abilityName(entry.type, ability)}
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-text">
                  {learned ? (
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={alwaysLearned.has(ability.id) || alwaysPrepared.has(ability.id)}
                        disabled={alwaysPrepared.has(ability.id)}
                        onChange={(event) =>
                          onToggle("alwaysLearnedAbilityIds", ability.id, event.target.checked)
                        }
                      />
                      Sempre aprendida
                    </label>
                  ) : null}
                  {prepared ? (
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={alwaysPrepared.has(ability.id)}
                        onChange={(event) =>
                          onToggle("alwaysPreparedAbilityIds", ability.id, event.target.checked)
                        }
                      />
                      Sempre preparada
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function FormulaOverrideControl({
  label,
  original,
  value,
  onChange,
}: {
  label: string
  original?: string
  value: string
  onChange: (value: string | undefined) => void
}) {
  return (
    <label className="grid gap-1.5 text-[11px] text-textMuted">
      <span className="font-medium text-textH">{label}</span>
      <textarea
        value={value}
        rows={3}
        placeholder={original?.trim() || "Digite uma fórmula para substituir o limite padrão"}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="min-h-20 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs leading-5 text-textH"
      />
      <span className="leading-4">
        {value.trim()
          ? "Esta fórmula substitui a fórmula padrão apenas neste personagem. Apague o campo para voltar ao padrão."
          : original?.trim()
            ? `Padrão do sistema: ${original}`
            : "Sem substituição: o limite fixo/padrão do sistema continua sendo usado."}
      </span>
    </label>
  )
}

function NumberControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-1 text-[11px] text-textMuted">
      {label}
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(event) =>
          onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))
        }
        className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
      />
    </label>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2 py-1">
      {children}
    </span>
  )
}

function hasConfigurableLimit(type: CustomAbilityTypeDefinition): boolean {
  const acquisition = type.acquisition
  if (!acquisition) return false
  const learned = usesLearned(acquisition.mode)
    && (acquisition.learnedLimit !== undefined || Boolean(acquisition.learnedLimitFormula?.trim()))
  const prepared = usesPrepared(acquisition.mode)
    && (acquisition.preparedLimit !== undefined || Boolean(acquisition.preparedLimitFormula?.trim()))
  return learned || prepared
}

function usesLearned(mode: CustomAbilityAcquisitionDefinition["mode"] | undefined): boolean {
  return mode === "learned" || mode === "learnedAndPrepared"
}

function usesPrepared(mode: CustomAbilityAcquisitionDefinition["mode"] | undefined): boolean {
  return mode === "prepared" || mode === "learnedAndPrepared"
}

function abilityName(type: CustomAbilityTypeDefinition, ability: CustomAbilityInstance): string {
  const titleFieldId = type.display.titleFieldId
  const direct = titleFieldId ? ability.values[titleFieldId] : undefined
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  const common = ability.values.nome ?? ability.values.name ?? ability.values.title
  if (typeof common === "string" && common.trim()) return common.trim()
  const preset = type.predefinedAbilities?.find((entry) => entry.id === ability.predefinedAbilityId)
  const presetCommon = preset?.values.nome ?? preset?.values.name ?? preset?.values.title
  if (typeof presetCommon === "string" && presetCommon.trim()) return presetCommon.trim()
  return preset?.description?.trim() || "Habilidade sem nome"
}

function keyFor(entry: EligibleType): string {
  return `${entry.definition.id}:${entry.type.id}`
}

function cloneException(value: CustomAbilityAcquisitionExceptionState): ExceptionDraft {
  return {
    learnedLimitFormulaOverride: value.learnedLimitFormulaOverride,
    preparedLimitFormulaOverride: value.preparedLimitFormulaOverride,
    extraLearnedSlots: value.extraLearnedSlots,
    extraPreparedSlots: value.extraPreparedSlots,
    alwaysLearnedAbilityIds: [...(value.alwaysLearnedAbilityIds ?? [])],
    alwaysPreparedAbilityIds: [...(value.alwaysPreparedAbilityIds ?? [])],
  }
}

function withDraftException(
  state: CharacterCustomSystemState,
  typeId: string,
  draft: ExceptionDraft,
): CharacterCustomSystemState {
  return {
    ...state,
    abilityAcquisitionExceptions: {
      ...(state.abilityAcquisitionExceptions ?? {}),
      [typeId]: draft,
    },
  }
}
