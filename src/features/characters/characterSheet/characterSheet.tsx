import { useEffect, useState } from "react"

import { Input } from "../../../components/ui/Input"
import type { CharacterCondition } from "../../../models/characters/CharacterCondition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getCharacterConditions } from "../../../models/characters/characterConditionStorage"
import { setMaxHp } from "../../../models/characters/characterHp"
import type { DamageAffinity } from "../../../models/combat/Damage"
import type { SessionConditionOperation } from "../../session-runtime/sessionProtocol"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { DamageAffinityEditor } from "../../combat/DamageAffinityEditor"
import {
  useCharacterWorkspace,
  type CharacterWorkspaceMode,
} from "../workspace/CharacterWorkspaceContext"

import { CharacterConditions } from "./characterConditions"
import { CharacterIdentity } from "./character_info/characterIdentity"
import { MinimalCharacterSheet } from "./minimalCharacterSheet"
import { MinimalMagicActions } from "./minimalMagicActions"
import { Skills } from "./skills/skills"
import { UserCharacterStatistics } from "./userCharacterStatistics"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type SheetViewMode = "play" | "configuration"

const SHEET_VIEW_STORAGE_KEY = "dnd-manager:character-sheet-view"

export function CharacterSheetTab({
  character,
  updateCharacter,
}: Props) {
  const {
    mode,
    dispatchConditionOperation,
  } = useCharacterWorkspace()
  const sessionRuntime = useOptionalSessionRuntime()
  const [viewMode, setViewMode] = useState<SheetViewMode>(() =>
    loadSheetViewMode(mode),
  )

  useEffect(() => {
    setViewMode(loadSheetViewMode(mode))
  }, [mode])

  useEffect(() => {
    saveSheetViewMode(mode, viewMode)
  }, [mode, viewMode])

  function updateConditions(
    characterId: string,
    updater: (current: CharacterTemplate) => CharacterTemplate,
  ) {
    if (characterId !== character.get("id")) {
      updateCharacter(characterId, updater)
      return
    }

    const next = updater(character)
    const operation = deriveConditionOperation(character, next)
    if (operation && dispatchConditionOperation(operation)) return

    updateCharacter(characterId, updater)
  }

  function updateDamageAffinities(damageAffinities: DamageAffinity[]) {
    if (mode === "campaign" && sessionRuntime) {
      if (sessionRuntime.status !== "connected") {
        console.warn("[session-runtime] Damage-affinity change ignored while the authoritative session server is disconnected.")
        return
      }
      sessionRuntime.dispatchAbilityOperation({
        type: "character.damageAffinities.set",
        characterId: character.get("id"),
        damageAffinities,
      })
      return
    }

    updateCharacter(character.get("id"), (current) =>
      current.withSheet("damageAffinities", damageAffinities),
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-2 shadow-theme-sm">
        <div className="min-w-0 px-1">
          <div className="text-xs font-semibold text-textH">Visualização da ficha</div>
          <div className="text-[10px] text-textMuted">
            {viewMode === "play"
              ? "Use a visão de jogo para consultar e alterar o que importa durante a partida."
              : "Use a configuração para ajustar os dados estruturais da ficha."}
          </div>
        </div>

        <div className="flex shrink-0 rounded-lg border border-border bg-bg-subtle p-1">
          <button
            type="button"
            aria-pressed={viewMode === "play"}
            onClick={() => setViewMode("play")}
            className={
              viewMode === "play"
                ? "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accentText"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            }
          >
            Em jogo
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "configuration"}
            onClick={() => setViewMode("configuration")}
            className={
              viewMode === "configuration"
                ? "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accentText"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            }
          >
            Configuração
          </button>
        </div>
      </div>

      {viewMode === "play" ? (
        <>
          <MinimalCharacterSheet
            character={character}
            updateCharacter={updateCharacter}
          />
          <MinimalMagicActions
            character={character}
            updateCharacter={updateCharacter}
          />
          <CharacterConditions
            character={character}
            updateCharacter={updateConditions}
          />
        </>
      ) : (
        <>
          {mode === "campaign" ? (
            <SessionConfigurationHeader
              connected={sessionRuntime?.status === "connected"}
              role={sessionRuntime?.role}
            />
          ) : null}

          <CharacterIdentity
            character={character}
            updateCharacter={updateCharacter}
          />

          <MaximumHpConfiguration
            character={character}
            updateCharacter={updateCharacter}
          />

          <UserCharacterStatistics
            character={character}
            updateCharacter={updateCharacter}
          />

          <DamageAffinityEditor
            title="Afinidades de dano"
            description="Resistências, imunidades e vulnerabilidades estruturais do personagem. Benefícios temporários de habilidades e condições são somados durante o jogo."
            value={character.get("sheet").damageAffinities ?? []}
            onChange={updateDamageAffinities}
          />

          <Skills
            character={character}
            updateCharacter={updateCharacter}
          />
        </>
      )}
    </div>
  )
}

function MaximumHpConfiguration({
  character,
  updateCharacter,
}: Props) {
  const { mode } = useCharacterWorkspace()
  const sessionRuntime = useOptionalSessionRuntime()
  const maxHp = character.get("sheet").HP.max

  function updateMaximumHp(value: number) {
    if (mode === "campaign" && sessionRuntime) {
      if (sessionRuntime.status !== "connected") {
        console.warn("[session-runtime] Max-HP change ignored while the authoritative session server is disconnected.")
        return
      }
      sessionRuntime.dispatchHpOperation({
        type: "character.hp.max.set",
        characterId: character.get("id"),
        value,
      })
      return
    }

    updateCharacter(character.get("id"), (current) =>
      setMaxHp(current, value),
    )
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-textH">
          Pontos de vida máximos
        </h2>
        <p className="mt-1 text-xs text-textMuted">
          Valor estrutural da ficha. Vida atual e temporária pertencem à visão em jogo.
        </p>
      </div>

      <label className="grid max-w-48 gap-1 text-xs text-textMuted">
        Vida máxima
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={maxHp}
          onChange={(event) =>
            updateMaximumHp(
              Math.max(1, Math.trunc(Number(event.target.value) || 1)),
            )
          }
        />
      </label>
    </section>
  )
}

function deriveConditionOperation(
  before: CharacterTemplate,
  after: CharacterTemplate,
): SessionConditionOperation | null {
  const beforeConditions = getCharacterConditions(before)
  const afterConditions = getCharacterConditions(after)
  if (JSON.stringify(beforeConditions) === JSON.stringify(afterConditions)) return null

  const beforeById = new Map(beforeConditions.map((condition) => [condition.id, condition]))
  const afterById = new Map(afterConditions.map((condition) => [condition.id, condition]))
  const added = afterConditions.filter((condition) => !beforeById.has(condition.id))
  const removed = beforeConditions.filter((condition) => !afterById.has(condition.id))
  const changed = afterConditions.filter((condition) => {
    const previous = beforeById.get(condition.id)
    return previous && JSON.stringify(previous) !== JSON.stringify(condition)
  })

  const characterId = before.get("id")
  if (added.length === 1 && removed.length === 0 && changed.length === 0) {
    return {
      type: "character.condition.add",
      characterId,
      condition: added[0] as CharacterCondition,
    }
  }
  if (removed.length === 1 && added.length === 0 && changed.length === 0) {
    return {
      type: "character.condition.remove",
      characterId,
      conditionId: removed[0].id,
    }
  }
  if (changed.length === 1 && added.length === 0 && removed.length === 0) {
    return {
      type: "character.condition.update",
      characterId,
      condition: changed[0] as CharacterCondition,
    }
  }

  console.warn("[session-runtime] Complex multi-condition mutation was not sent to the authoritative server.")
  return null
}

function SessionConfigurationHeader({
  connected,
  role,
}: {
  connected: boolean
  role?: "MASTER" | "PLAYER"
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-textH">
          Configuração da ficha na sessão
        </div>
        <div className="mt-0.5 text-xs text-textMuted">
          Ajuste os dados estruturais da ficha. Operações suportadas são validadas e sincronizadas pela sessão.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
        <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-textMuted">
          {role === "MASTER" ? "Mestre" : role === "PLAYER" ? "Jogador" : "Sessão"}
        </span>
        <span
          className={
            connected
              ? "rounded-full border border-success bg-successBg px-2.5 py-1 text-success"
              : "rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-textMuted"
          }
        >
          {connected ? "Sincronizada" : "Sem conexão"}
        </span>
      </div>
    </div>
  )
}

function loadSheetViewMode(mode: CharacterWorkspaceMode): SheetViewMode {
  if (typeof window === "undefined") {
    return defaultSheetViewMode(mode)
  }

  try {
    const stored = window.localStorage.getItem(sheetViewStorageKey(mode))
    return stored === "play" || stored === "configuration"
      ? stored
      : defaultSheetViewMode(mode)
  } catch {
    return defaultSheetViewMode(mode)
  }
}

function defaultSheetViewMode(mode: CharacterWorkspaceMode): SheetViewMode {
  return mode === "campaign" ? "play" : "configuration"
}

function sheetViewStorageKey(mode: CharacterWorkspaceMode) {
  return `${SHEET_VIEW_STORAGE_KEY}:${mode}`
}

function saveSheetViewMode(
  mode: CharacterWorkspaceMode,
  viewMode: SheetViewMode,
) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(sheetViewStorageKey(mode), viewMode)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}