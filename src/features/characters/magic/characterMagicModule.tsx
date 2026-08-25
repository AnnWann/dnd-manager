// features/characters/spells/CharacterSpellsModule.tsx

import { useEffect, useMemo, useState } from "react"

import {
  queryAllOfficialSpellSummaries,
  type SpellCompendiumSummary,
} from "../../../api/spell-compendium"
import { Button } from "../../../components/ui/Button"
import { Card, CardHeader } from "../../../components/ui/Card"
import { useMagicContext } from "../../../contexts/magicContext"
import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getSorcererLevel } from "../../../models/characters/characterSorceryPoints"
import type { CharacterSpells } from "../../../models/magic/spells/CharacterSpells"
import type { Spell } from "../../../models/magic/spells/Spell"
import type {
  CharacterClassInterface,
  ClassName,
} from "../../../models/sheet/Class"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { ChannelDivinityModule } from "./channelDivinityModule"
import { KiModule } from "./kiModule"
import { KnownSpellsList } from "./knownSpellsList"
import { MetamagicModule } from "./metamagicModule"
import { OnDemandCharacterSpellLibrary } from "./OnDemandCharacterSpellLibrary"
import { SpellSlotsEditor } from "./slots"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type KnownSpellEntry = CharacterSpells["knownSpells"][number]
type DivineSpellCatalog = {
  classEntry: CharacterClassInterface
  spells: SpellCompendiumSummary[]
}

const DIVINE_PREPARED_CLASSES: readonly ClassName[] = [
  "cleric",
  "druid",
  "paladin",
]

export function CharacterMagicTab({
  character,
  updateCharacter,
}: Props) {
  const workspace = useCharacterWorkspace()
  const { characters, currentOwner, mode } = workspace
  const sessionRuntime = useOptionalSessionRuntime()
  const { getSpellByIndex } = useMagicContext()
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  )
  const [addingSpell, setAddingSpell] = useState(false)
  const sorcererLevel = getSorcererLevel(character)
  const hasSorcererResources = sorcererLevel >= 2
  const spellListText = useMemo(
    () => buildAllCharacterSpellList(characters, getSpellByIndex),
    [characters, getSpellByIndex],
  )
  const canCopySpellList = spellListText.trim().length > 0
  const characterOwnerId = character.get("owner").id?.trim()
  const canManuallyAddSpell =
    mode === "campaign" &&
    sessionRuntime?.status === "connected" &&
    (sessionRuntime.role === "MASTER" ||
      Boolean(
        characterOwnerId &&
          currentOwner?.id?.trim() &&
          currentOwner.id.trim() === characterOwnerId,
      ))
  const divineClasses = (character.get("sheet").classes ?? []).filter((entry) =>
    DIVINE_PREPARED_CLASSES.includes(entry.className),
  )
  const divineCatalogRequestKey = divineClasses
    .map((entry) => `${entry.className}:${maximumSpellLevelForClass(entry)}`)
    .sort()
    .join("|")

  useEffect(() => {
    if (!divineCatalogRequestKey) return

    let cancelled = false
    void Promise.all(
      divineClasses.map(async (classEntry): Promise<DivineSpellCatalog> => {
        const availableLevel = maximumSpellLevelForClass(classEntry)
        if (availableLevel <= 0) return { classEntry, spells: [] }

        const page = await queryAllOfficialSpellSummaries({
          className: classEntry.className,
          maxLevel: availableLevel,
        })
        return { classEntry, spells: page.spells }
      }),
    )
      .then((catalogs) => {
        if (cancelled) return

        updateCharacter(character.get("id"), (current) => {
          const missingSpells = getMissingDivineClassSpells(current, catalogs)
          if (missingSpells.length === 0) return current

          let nextCharacter = current
          for (const spellEntry of missingSpells) {
            nextCharacter = nextCharacter.addSpell(spellEntry)
          }
          return nextCharacter
        })
      })
      .catch(() => {
        // The existing character spell list remains usable if the compendium
        // cannot be reconciled. A later navigation/retry can reconcile again.
      })

    return () => {
      cancelled = true
    }
  }, [divineCatalogRequestKey, updateCharacter])

  useEffect(() => {
    if (!canManuallyAddSpell && addingSpell) setAddingSpell(false)
  }, [addingSpell, canManuallyAddSpell])

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
              <div className="text-sm font-semibold text-textH">Magias</div>

              <div className="mt-1 text-xs text-text">
                Gerencie magias conhecidas, preparadas e slots.
              </div>
            </div>

            <div className="grid gap-2 sm:justify-items-end">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canCopySpellList}
                  onClick={copyAllSpellLists}
                >
                  Copiar listas do grupo
                </Button>

                {mode === "campaign" ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!canManuallyAddSpell}
                    onClick={() => setAddingSpell((current) => !current)}
                  >
                    {addingSpell ? "Fechar adição" : "Adicionar magia"}
                  </Button>
                ) : null}
              </div>

              {copyStatus === "copied" ? (
                <span className="text-xs text-accent">Listas copiadas.</span>
              ) : copyStatus === "error" ? (
                <span className="text-xs text-danger">
                  Não foi possível copiar.
                </span>
              ) : !canManuallyAddSpell && mode === "campaign" ? (
                <span className="text-xs text-textMuted">
                  Para adicionar magias manualmente, use seu próprio personagem
                  com a sessão conectada.
                </span>
              ) : (
                <span className="text-xs text-textMuted">
                  Copia personagem, nível e nome da magia.
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <ChannelDivinityModule
          character={character}
          updateCharacter={updateCharacter}
        />

        <KiModule character={character} updateCharacter={updateCharacter} />

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
      </Card>

      {addingSpell && canManuallyAddSpell ? (
        <OnDemandCharacterSpellLibrary
          character={character}
          updateCharacter={updateCharacter}
          sourcePolicy="session-manual"
          allowCampaignGrant={sessionRuntime?.role === "MASTER"}
          onCancel={() => setAddingSpell(false)}
          onSpellAdded={() => setAddingSpell(false)}
        />
      ) : null}

      <KnownSpellsList
        character={character}
        updateCharacter={updateCharacter}
      />
    </div>
  )
}

function buildAllCharacterSpellList(
  characters: CharacterTemplate[],
  getSpellByIndex: (index: string) => Spell | undefined,
): string {
  return characters
    .flatMap((entry) => buildCharacterSpellList(entry, getSpellByIndex))
    .filter(Boolean)
    .join("\n")
}

function buildCharacterSpellList(
  character: CharacterTemplate,
  getSpellByIndex: (index: string) => Spell | undefined,
): string[] {
  const level = (character.get("sheet").classes ?? []).reduce(
    (total, entry) => total + entry.level,
    0,
  )
  const name = character.get("name")
  const knownSpells = character.get("magic")?.spells.knownSpells ?? []
  const grantedSpells = getCharacterGrantedSpells(character)
  const seen = new Set<string>()
  const rows: string[] = []

  for (const entry of knownSpells) {
    const spell = getSpellByIndex(entry.spells.id)
    if (!spell || seen.has(spell.index)) continue
    seen.add(spell.index)
    rows.push(`${name} | Nível ${level} | ${spell.name}`)
  }

  for (const grant of grantedSpells) {
    const spell = getSpellByIndex(grant.index)
    if (!spell || seen.has(spell.index)) continue
    seen.add(spell.index)
    rows.push(`${name} | Nível ${level} | ${spell.name}`)
  }

  return rows
}

function getMissingDivineClassSpells(
  character: CharacterTemplate,
  catalogs: DivineSpellCatalog[],
): KnownSpellEntry[] {
  const knownSpells = character.get("magic")?.spells.knownSpells ?? []
  const knownIndexes = new Set(knownSpells.map((entry) => entry.spells.id))
  const missing: KnownSpellEntry[] = []

  for (const { classEntry, spells } of catalogs) {
    for (const spell of spells) {
      if (knownIndexes.has(spell.index)) continue

      knownIndexes.add(spell.index)
      missing.push({
        spells: {
          id: spell.index,
          prepared: false,
        },
        source: {
          type: "class",
          sourceId: classEntry.className,
          name: classEntry.className,
          attribute:
            classEntry.castingAttribute ??
            (classEntry.className === "paladin" ? "cha" : "wis"),
        },
      })
    }
  }

  return missing
}

function maximumSpellLevelForClass(
  classEntry: CharacterClassInterface,
): number {
  const level = classEntry.level

  switch (classEntry.className) {
    case "cleric":
    case "druid":
      return Math.min(9, Math.ceil(level / 2))
    case "paladin":
      return level < 2 ? 0 : Math.min(5, Math.ceil((level - 1) / 2))
    default:
      return 0
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()

  if (!copied) throw new Error("Clipboard unavailable")
}
