// features/characters/spells/CharacterSpellsModule.tsx

import { useMemo, useState } from "react"

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

export function CharacterMagicTab({
  character,
  updateCharacter,
}: Props) {
  const { visibleCharacters } = useCharacterContext()
  const { getSpellByIndex } = useMagicContext()
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const sorcererLevel = getSorcererLevel(character)
  const hasSorcererResources = sorcererLevel >= 2
  const spellListText = useMemo(
    () => buildAllCharacterSpellList(visibleCharacters, getSpellByIndex),
    [getSpellByIndex, visibleCharacters],
  )
  const canCopySpellList = spellListText.trim().length > 0

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

        <KnownSpellsList
          key={character.get("id")}
          character={character}
          updateCharacter={updateCharacter}
        />
      </Card>
    </div>
  )
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
