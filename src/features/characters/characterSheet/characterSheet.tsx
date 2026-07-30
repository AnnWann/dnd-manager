import { useEffect, useState } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

import { AttributeCalculators } from "./attributeCalculators"
import { Attributes } from "./attributes"
import { CharacterConditions } from "./characterConditions"
import { CharacterIdentity } from "./character_info/characterIdentity"
import { GroupActions } from "./character_info/components/actions/GroupActions"
import { GroupHP } from "./character_info/components/hp/GroupHP"
import { GroupStats } from "./character_info/components/stats/GroupStats"
import { MinimalCharacterSheet } from "./minimalCharacterSheet"
import { SavingThrows } from "./savingThrows"
import { Skills } from "./skills/skills"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  canAssignOwners: boolean
}

type SheetViewMode = "full" | "minimal"

const SHEET_VIEW_STORAGE_KEY = "dnd-manager:character-sheet-view"

export function CharacterSheetTab({
  character,
  updateCharacter,
  canAssignOwners,
}: Props) {
  const [viewMode, setViewMode] = useState<SheetViewMode>(loadSheetViewMode)
  const showActionEconomy = canAssignOwners

  useEffect(() => {
    saveSheetViewMode(viewMode)
  }, [viewMode])

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-2 shadow-theme-sm">
        <div className="min-w-0 px-1">
          <div className="text-xs font-semibold text-textH">Visualização da ficha</div>
          <div className="text-[10px] text-textMuted">
            Alterne entre a ficha completa e a versão reduzida.
          </div>
        </div>

        <div className="flex shrink-0 rounded-lg border border-border bg-bg-subtle p-1">
          <button
            type="button"
            aria-pressed={viewMode === "full"}
            onClick={() => setViewMode("full")}
            className={
              viewMode === "full"
                ? "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accentText"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            }
          >
            Completa
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "minimal"}
            onClick={() => setViewMode("minimal")}
            className={
              viewMode === "minimal"
                ? "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accentText"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            }
          >
            Minimalista
          </button>
        </div>
      </div>

      {viewMode === "minimal" ? (
        <>
          <MinimalCharacterSheet
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

          <div
            className={
              showActionEconomy
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

            {showActionEconomy ? (
              <GroupActions
                character={character}
                updateCharacter={updateCharacter}
              />
            ) : null}
          </div>

          <AttributeCalculators character={character} />
        </>
      )}
    </div>
  )
}

function loadSheetViewMode(): SheetViewMode {
  if (typeof window === "undefined") return "full"

  try {
    return window.localStorage.getItem(SHEET_VIEW_STORAGE_KEY) === "minimal"
      ? "minimal"
      : "full"
  } catch {
    return "full"
  }
}

function saveSheetViewMode(viewMode: SheetViewMode) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(SHEET_VIEW_STORAGE_KEY, viewMode)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}
