import { useEffect, useState } from "react"

import { useCustomSystemDefinitions } from "../../../lib/customSystems/CustomSystemRegistry"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { DamageAffinityEditor } from "../../combat/DamageAffinityEditor"
import {
  useCharacterWorkspace,
  type CharacterWorkspaceMode,
} from "../workspace/CharacterWorkspaceContext"

import { AttributeCalculators } from "./attributeCalculators"
import { Attributes } from "./attributes"
import { CharacterConditions } from "./characterConditions"
import { CharacterIdentity } from "./character_info/characterIdentity"
import {
  CustomSystemActionsPanel,
  hasCustomSystemSheetActions,
} from "./character_info/components/actions/CustomSystemActionsPanel"
import { GroupActions } from "./character_info/components/actions/GroupActions"
import { GroupHP } from "./character_info/components/hp/GroupHP"
import { GroupStats } from "./character_info/components/stats/GroupStats"
import { MinimalCharacterSheet } from "./minimalCharacterSheet"
import { MinimalMagicActions } from "./minimalMagicActions"
import { SavingThrows } from "./savingThrows"
import { Skills } from "./skills/skills"

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
  const { mode, canAssignOwners } = useCharacterWorkspace()
  const sessionRuntime = useOptionalSessionRuntime()
  const [viewMode, setViewMode] = useState<SheetViewMode>(() =>
    loadSheetViewMode(mode),
  )
  const customSystemDefinitions = useCustomSystemDefinitions()
  const showActionEconomy = canAssignOwners
  const showCustomActions = hasCustomSystemSheetActions(
    character,
    customSystemDefinitions,
  )
  const showActionsColumn = showActionEconomy || showCustomActions

  useEffect(() => {
    setViewMode(loadSheetViewMode(mode))
  }, [mode])

  useEffect(() => {
    saveSheetViewMode(mode, viewMode)
  }, [mode, viewMode])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-2 shadow-theme-sm">
        <div className="min-w-0 px-1">
          <div className="text-xs font-semibold text-textH">Visualização da ficha</div>
          <div className="text-[10px] text-textMuted">
            {viewMode === "play"
              ? "Use a visão de jogo para consultar e alterar o que importa durante a partida."
              : "Use a configuração para ajustar a estrutura e os valores completos da ficha."}
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
            updateCharacter={updateCharacter}
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

          <GroupHP character={character} updateCharacter={updateCharacter} />
          <CharacterConditions
            character={character}
            updateCharacter={updateCharacter}
          />
          <GroupStats character={character} updateCharacter={updateCharacter} />
          <DamageAffinityEditor
            value={character.get("sheet").damageAffinities ?? []}
            onChange={(damageAffinities) =>
              updateCharacter(character.get("id"), (current) =>
                current.withSheet("damageAffinities", damageAffinities),
              )
            }
          />

          <div
            className={
              showActionsColumn
                ? "grid items-start gap-4 xl:grid-cols-[280px_minmax(360px,1fr)_minmax(320px,0.9fr)]"
                : "grid items-start gap-4 xl:grid-cols-[280px_minmax(360px,1fr)]"
            }
          >
            <div className="grid gap-4">
              <Attributes character={character} updateCharacter={updateCharacter} />
              <SavingThrows
                character={character}
                updateCharacter={updateCharacter}
              />
            </div>

            <Skills character={character} updateCharacter={updateCharacter} />

            {showActionsColumn ? (
              <div className="grid gap-4">
                {showCustomActions ? (
                  <CustomSystemActionsPanel
                    character={character}
                    updateCharacter={updateCharacter}
                  />
                ) : null}
                {showActionEconomy ? (
                  <GroupActions
                    character={character}
                    updateCharacter={updateCharacter}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <AttributeCalculators character={character} />
        </>
      )}
    </div>
  )
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
          Ajuste os dados completos da ficha. Operações suportadas são validadas e sincronizadas pela sessão.
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
