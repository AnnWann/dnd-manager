import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { adjustCustomResource } from '../../../lib/customSystems/CustomSystemState'
import { useCustomSystemDefinitions } from '../../../lib/customSystems/CustomSystemRegistry'
import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from '../../../models/customSystems/CustomSystemDefinition'
import { useOptionalSessionRuntime } from '../../session-runtime/useSessionRuntime'

export function CustomSystemActionResources({
  character,
  updateCharacter,
}: {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}) {
  const definitions = useCustomSystemDefinitions()
  const runtime = useOptionalSessionRuntime()
  const [error, setError] = useState('')
  const entries = collectEntries(character, definitions)

  if (!entries.length) return null

  function adjust(entry: ResourceEntry, amount: number) {
    setError('')
    if (runtime) {
      if (runtime.status !== 'connected') {
        setError('A sessão está desconectada. Não foi possível alterar o recurso.')
        return
      }
      const sent = runtime.dispatchAbilityOperation({
        type: 'character.customSystem.resource.adjust',
        characterId: character.get('id'),
        systemId: entry.definition.id,
        resourceId: entry.resource.id,
        amount,
      })
      if (!sent) setError('Não foi possível enviar a alteração do recurso para a sessão.')
      return
    }

    try {
      updateCharacter(character.get('id'), (current) => {
        const states = current.get('sheet').customSystems ?? []
        const state = states.find((candidate) => candidate.systemId === entry.definition.id)
        if (!state) return current
        const next = adjustCustomResource(
          entry.definition,
          state,
          entry.resource.id,
          amount,
          'owner',
        )
        return current.withSheet(
          'customSystems',
          states.map((candidate) =>
            candidate.systemId === entry.definition.id ? next : candidate,
          ),
        )
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível alterar o recurso.')
    }
  }

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        Recursos
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry) => {
          const current = entry.state.current
          const maximum = entry.state.maximum ?? entry.resource.maximum
          const minimum = entry.resource.minimum ?? 0
          const canAdjust = entry.resource.allowManualAdjustment === true
          return (
            <article
              key={`${entry.definition.id}:${entry.resource.id}`}
              className="rounded-lg border border-border bg-bg-subtle px-3 py-2"
            >
              <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                {entry.resource.name}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                {canAdjust ? (
                  <button
                    type="button"
                    title={`Reduzir ${entry.resource.name}`}
                    disabled={current <= minimum}
                    onClick={() => adjust(entry, -1)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-textH hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1 text-center">
                  <div className="text-base font-bold text-textH">
                    {formatNumber(current)}{maximum !== undefined ? ` / ${formatNumber(maximum)}` : ''}
                  </div>
                  <div className="truncate text-[10px] text-textMuted">{entry.definition.name}</div>
                </div>
                {canAdjust ? (
                  <button
                    type="button"
                    title={`Aumentar ${entry.resource.name}`}
                    disabled={maximum !== undefined && current >= maximum}
                    onClick={() => adjust(entry, 1)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-textH hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {entry.state.temporary ? (
                <div className="mt-1 text-center text-[10px] text-accent">
                  Temporário: {formatNumber(entry.state.temporary)}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      {error ? (
        <div className="mt-2 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}
    </div>
  )
}

type ResourceEntry = {
  definition: CustomSystemDefinition
  systemState: CharacterCustomSystemState
  resource: CustomSystemDefinition['resources'][number]
  state: CharacterCustomSystemState['resources'][string]
}

function collectEntries(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
): ResourceEntry[] {
  const states = character.get('sheet').customSystems ?? []
  const entries: ResourceEntry[] = []

  for (const systemState of states) {
    if (systemState.enabled === false) continue
    const definition = definitions.find((candidate) => candidate.id === systemState.systemId)
    if (!definition || definition.hiddenFromSheet) continue
    for (const resource of definition.resources) {
      if (resource.showInActions !== true) continue
      const state = systemState.resources[resource.id]
      if (!state) continue
      entries.push({ definition, systemState, resource, state })
    }
  }

  return entries.sort((left, right) =>
    left.definition.name.localeCompare(right.definition.name, 'pt-BR')
    || left.resource.name.localeCompare(right.resource.name, 'pt-BR'),
  )
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}
