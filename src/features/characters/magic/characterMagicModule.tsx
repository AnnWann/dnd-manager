// features/characters/spells/CharacterSpellsModule.tsx

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardHeader } from "../../../components/ui/Card"
import { useCharacterContext } from "../../../contexts/characterContext"
import { useMagicContext } from "../../../contexts/magicContext"
import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getSorcererLevel } from "../../../models/characters/characterSorceryPoints"
import type { Spell } from "../../../models/magic/spells/Spell"
import { KnownSpellsList } from "./knownSpellsList"
import { MetamagicModule } from "./metamagicModule"
import { SpellSlotsEditor } from "./slots"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

const SPELL_LIST_CONTROL_KEYS = {
  "Visualização": "viewMode",
  "Disponibilidade": "preparedFilter",
  "Forma de aquisição": "sourceTypeFilter",
  "Origem específica": "specificSourceFilter",
} as const

type SpellListControlKey =
  (typeof SPELL_LIST_CONTROL_KEYS)[keyof typeof SPELL_LIST_CONTROL_KEYS]

type PersistedSpellListControls = Partial<Record<SpellListControlKey, string>>

export function CharacterMagicTab({
  character,
  updateCharacter,
}: Props) {
  const { visibleCharacters } = useCharacterContext()
  const { getSpellByIndex } = useMagicContext()
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const spellListContainerRef = useRef<HTMLDivElement | null>(null)
  const characterId = character.get("id")
  const sorcererLevel = getSorcererLevel(character)
  const hasSorcererResources = sorcererLevel >= 2
  const spellListText = useMemo(
    () => buildAllCharacterSpellList(visibleCharacters, getSpellByIndex),
    [getSpellByIndex, visibleCharacters],
  )
  const canCopySpellList = spellListText.trim().length > 0

  useSpellListFilterPersistence(spellListContainerRef, characterId)

  async function copyAllSpellLists() {
    if (!canCopySpellList) return

    try {
      await copyText(spellListText)
      setCopyStatus("copied")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    } catch {
      setCopyStatus("error")
      window.setTimeout(() => setCopyStatus("idle"), 2500)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-textH">
                Magias
              </div>

              <div className="mt-1 text-xs text-text">
                Gerencie magias conhecidas, preparadas e slots.
              </div>
            </div>

            <div className="grid gap-1 sm:justify-items-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={!canCopySpellList}
                onClick={copyAllSpellLists}
              >
                Copiar listas do grupo
              </Button>

              {copyStatus === "copied" ? (
                <span className="text-xs text-accent">
                  Listas copiadas.
                </span>
              ) : copyStatus === "error" ? (
                <span className="text-xs text-danger">
                  Não foi possível copiar.
                </span>
              ) : (
                <span className="text-xs text-textMuted">
                  Copia personagem, nível e nome da magia.
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        {hasSorcererResources ? (
          <MetamagicModule
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        <SpellSlotsEditor
          character={character}
          updateCharacter={updateCharacter}
        />

        <div ref={spellListContainerRef}>
          <KnownSpellsList
            character={character}
            updateCharacter={updateCharacter}
          />
        </div>
      </Card>
    </div>
  )
}

function useSpellListFilterPersistence(
  containerRef: RefObject<HTMLDivElement | null>,
  characterId: string,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof window === "undefined") return

    const storageKey = `dnd-manager:character-spell-list:${characterId}`
    let restoring = false
    let restoreFrame = 0
    let specificSourceFrame = 0

    function readPersistedControls(): PersistedSpellListControls {
      try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return {}

        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === "object"
          ? (parsed as PersistedSpellListControls)
          : {}
      } catch {
        return {}
      }
    }

    function getControlKey(select: HTMLSelectElement): SpellListControlKey | undefined {
      const label = select.closest("label")
      const labelText = label?.textContent?.trim() ?? ""

      for (const [labelPrefix, key] of Object.entries(SPELL_LIST_CONTROL_KEYS)) {
        if (labelText.startsWith(labelPrefix)) return key
      }

      return undefined
    }

    function findControl(key: SpellListControlKey): HTMLSelectElement | undefined {
      return Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
        (select) => getControlKey(select) === key,
      )
    }

    function applyValue(key: SpellListControlKey, value: string | undefined) {
      if (!value) return

      const select = findControl(key)
      if (!select || select.value === value) return

      const hasOption = Array.from(select.options).some(
        (option) => option.value === value,
      )
      if (!hasOption) return

      select.value = value
      select.dispatchEvent(new Event("change", { bubbles: true }))
    }

    function persistCurrentControls() {
      const next: PersistedSpellListControls = {}

      for (const select of container.querySelectorAll<HTMLSelectElement>("select")) {
        const key = getControlKey(select)
        if (key) next[key] = select.value
      }

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Storage can be unavailable in private or restricted browser contexts.
      }
    }

    function restoreControls() {
      if (restoring) return
      restoring = true

      const persisted = readPersistedControls()
      applyValue("viewMode", persisted.viewMode)
      applyValue("preparedFilter", persisted.preparedFilter)
      applyValue("sourceTypeFilter", persisted.sourceTypeFilter)

      window.cancelAnimationFrame(specificSourceFrame)
      specificSourceFrame = window.requestAnimationFrame(() => {
        applyValue("specificSourceFilter", persisted.specificSourceFilter)
        restoring = false
      })
    }

    function scheduleRestore() {
      window.cancelAnimationFrame(restoreFrame)
      restoreFrame = window.requestAnimationFrame(restoreControls)
    }

    function handleChange(event: Event) {
      if (restoring) return
      const target = event.target
      if (!(target instanceof HTMLSelectElement) || !container.contains(target)) {
        return
      }
      if (!getControlKey(target)) return
      persistCurrentControls()
    }

    const observer = new MutationObserver(scheduleRestore)
    observer.observe(container, { childList: true, subtree: true })
    container.addEventListener("change", handleChange)
    scheduleRestore()

    return () => {
      observer.disconnect()
      container.removeEventListener("change", handleChange)
      window.cancelAnimationFrame(restoreFrame)
      window.cancelAnimationFrame(specificSourceFrame)
    }
  }, [characterId, containerRef])
}

function buildAllCharacterSpellList(
  characters: CharacterTemplate[],
  getSpellByIndex: (spellIndex: string) => Spell | undefined,
): string {
  const blocks: string[] = []

  for (const character of characters) {
    const characterName = character.get("name").trim() || "Personagem sem nome"
    const spells = getCharacterSpellRows(character, getSpellByIndex)

    if (spells.length === 0) continue

    blocks.push([
      characterName,
      ...spells.map(
        (spell) =>
          `${spell.displayName || spell.name} - ${formatSpellLevel(spell.slotLevel)}`,
      ),
    ].join("\n"))
  }

  return blocks.join("\n\n")
}

function getCharacterSpellRows(
  character: CharacterTemplate,
  getSpellByIndex: (spellIndex: string) => Spell | undefined,
): Spell[] {
  const spellsByIndex = new Map<string, Spell>()

  for (const entry of character.get("magic")?.spells.knownSpells ?? []) {
    const spell = getSpellByIndex(entry.spells.id)
    if (spell?.index) spellsByIndex.set(spell.index, spell)
  }

  for (const entry of getCharacterGrantedSpells(character)) {
    const spell = getSpellByIndex(entry.index)
    if (spell?.index) spellsByIndex.set(spell.index, spell)
  }

  return Array.from(spellsByIndex.values()).toSorted((left, right) => {
    const levelDifference = left.slotLevel - right.slotLevel
    if (levelDifference !== 0) return levelDifference

    return (left.displayName || left.name).localeCompare(
      right.displayName || right.name,
      "pt-BR",
    )
  })
}

function formatSpellLevel(level: number): string {
  return level === 0 ? "Truque" : `Nível ${level}`
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.top = "-1000px"
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const copied = document.execCommand("copy")
    if (!copied) throw new Error("Copy command failed")
  } finally {
    document.body.removeChild(textarea)
  }
}
