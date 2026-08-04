import { useMemo, useRef, useState } from "react"
import { Download, Upload } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { useCharacterContext } from "../../contexts/characterContext"
import { useMagicContext } from "../../contexts/magicContext"
import type { Ability } from "../../models/abilities/Ability"
import type {
  CharacterTemplate,
  CharacterTemplateProps,
} from "../../models/characters/CharacterTemplate"
import type { Equipment } from "../../models/items/equipment/EquipmentSlot"
import type { Itemmable } from "../../models/items/item"
import type { Spell } from "../../models/magic/spells/Spell"
import { CharacterSelectorList } from "./selector/CharacterSelectorList"
import { toCampaignCharacterSelectorItem } from "./selector/campaignCharacterSelectorAdapter"

type Props = {
  characters: CharacterTemplate[]
  activeCharacter: CharacterTemplate
  addCharacter: () => void
  importCharacter: (rawCharacter: unknown) => CharacterTemplate
  setActiveCharacterId: (id: string) => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
}

type CharacterExportBundle = {
  format: "dnd-manager-character"
  version: 2
  character: CharacterTemplateProps
  homebrewSpells: Spell[]
}

export function CharacterSelector({
  characters,
  activeCharacter,
  addCharacter,
  importCharacter,
  setActiveCharacterId,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
}: Props) {
  const { setSelectedCharacterId } = useCharacterContext()
  const {
    getSpellByIndex,
    spellByIndex,
    saveSpell,
  } = useMagicContext()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState("")

  const [selectedCharacterId, setLocalSelectedCharacterId] =
    useState(activeCharacter.get("id"))

  const selectedCharacter = useMemo(
    () =>
      characters.find(
        (character) =>
          character.get("id") === selectedCharacterId,
      ) ?? activeCharacter,
    [activeCharacter, characters, selectedCharacterId],
  )

  const selectorCharacters = useMemo(
    () =>
      characters.map((character) =>
        toCampaignCharacterSelectorItem(character, {
          showOwnerBadge,
          getSpellByIndex,
        }),
      ),
    [
      characters,
      getSpellByIndex,
      showOwnerBadge,
    ],
  )

  function selectCharacter(characterId: string) {
    setLocalSelectedCharacterId(characterId)
    setSelectedCharacterId(characterId)
  }

  function openCharacter(characterId: string) {
    setLocalSelectedCharacterId(characterId)
    setSelectedCharacterId(characterId)
    setActiveCharacterId(characterId)
  }

  function exportSelectedCharacter() {
    const referencedSpellIndexes =
      collectReferencedSpellIndexes(selectedCharacter)

    const homebrewSpells = Array.from(
      referencedSpellIndexes,
    )
      .map((spellIndex) => getSpellByIndex(spellIndex))
      .filter(
        (spell): spell is Spell =>
          Boolean(spell?.homebrew),
      )

    const bundle: CharacterExportBundle = {
      format: "dnd-manager-character",
      version: 2,
      character: selectedCharacter.toJSON(),
      homebrewSpells,
    }

    const json = JSON.stringify(bundle, null, 2)
    const blob = new Blob([json], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    const safeName =
      selectedCharacter
        .get("name")
        .trim()
        .replace(/[^a-zA-Z0-9À-ÿ_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "personagem"

    anchor.href = url
    anchor.download = `${safeName}.json`

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    URL.revokeObjectURL(url)
  }

  async function importFromFile(file?: File) {
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const bundle = parseCharacterExport(parsed)

      const missingSpells = getMissingEmbeddedSpells(
        bundle.homebrewSpells,
        spellByIndex,
      )

      for (const spell of missingSpells) {
        saveSpell(spell)
      }

      const imported = importCharacter(bundle.character)
      const importedId = imported.get("id")

      setLocalSelectedCharacterId(importedId)
      setSelectedCharacterId(importedId)
      setImportError("")
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o personagem.",
      )
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function deleteSelectedCharacter(characterId: string) {
    if (disableDelete) return

    const character =
      characters.find(
        (entry) => entry.get("id") === characterId,
      ) ?? selectedCharacter

    const characterName =
      character.get("name").trim() ||
      "personagem selecionado"

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir permanentemente “${characterName}”?\n\n` +
        "Essa ação não pode ser desfeita. Exporte o JSON antes se quiser manter uma cópia.",
    )

    if (!confirmed) return

    setLocalSelectedCharacterId(characterId)
    setSelectedCharacterId(characterId)
    deleteActiveCharacter()
  }

  return (
    <>
      <CharacterSelectorList
        title="Personagens"
        characters={selectorCharacters}
        selectedCharacterId={selectedCharacterId}
        onSelectCharacter={selectCharacter}
        onOpenCharacter={openCharacter}
        onAddCharacter={addCharacter}
        onDeleteCharacter={
          disableDelete
            ? undefined
            : deleteSelectedCharacter
        }
        deleteDisabled={disableDelete}
        deleteDisabledReason={
          disableDelete
            ? "Mantenha pelo menos 1 personagem"
            : undefined
        }
        headerActions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={exportSelectedCharacter}
              title={`Exportar ${selectedCharacter.get("name")}`}
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              <Upload className="h-4 w-4" />
              Importar JSON
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) =>
          void importFromFile(
            event.target.files?.[0],
          )
        }
      />

      {importError ? (
        <div className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
          {importError}
        </div>
      ) : null}
    </>
  )
}

function collectReferencedSpellIndexes(
  character: CharacterTemplate,
): Set<string> {
  const indexes = new Set<string>()

  for (
    const knownSpell of
      character.get("magic")?.spells.knownSpells ?? []
  ) {
    addSpellIndex(
      indexes,
      knownSpell.spells.id,
    )
  }

  for (
    const ability of
      character.get("abilities") ?? []
  ) {
    collectAbilitySpellIndexes(indexes, ability)
  }

  for (
    const ability of
      character.get("sheet").race
        .naturalAbilities ?? []
  ) {
    collectAbilitySpellIndexes(indexes, ability)
  }

  const equipment = character.get("equipment")

  const equippedItems: Array<
    Itemmable | undefined
  > = [
    equipment.armor,
    equipment.shield,
    equipment.boots,
    equipment.gloves,
    equipment.helmet,
    equipment.cape,
    ...equipment.rings,
    ...equipment.weapons,
    ...equipment.pockets,
  ]

  for (const item of equippedItems) {
    if (item) {
      collectItemSpellIndexes(indexes, item)
    }
  }

  for (
    const item of character.get("inventory")
  ) {
    collectItemSpellIndexes(indexes, item)
  }

  return indexes
}

function collectAbilitySpellIndexes(
  indexes: Set<string>,
  ability: Ability,
) {
  for (
    const grant of ability.grantedSpells ?? []
  ) {
    addSpellIndex(indexes, grant.index)
  }
}

function collectItemSpellIndexes(
  indexes: Set<string>,
  item: Itemmable,
) {
  const equipment =
    item as Itemmable &
      Partial<
        Pick<
          Equipment,
          "abilities" | "spells"
        >
      >

  for (
    const spell of equipment.spells ?? []
  ) {
    addSpellIndex(indexes, spell.index)
  }

  for (
    const ability of equipment.abilities ?? []
  ) {
    collectAbilitySpellIndexes(
      indexes,
      ability,
    )
  }
}

function addSpellIndex(
  indexes: Set<string>,
  index?: string,
) {
  const normalized = index?.trim()

  if (normalized) {
    indexes.add(normalized)
  }
}

function parseCharacterExport(
  parsed: unknown,
): {
  character: unknown
  homebrewSpells: Spell[]
} {
  if (!isRecord(parsed)) {
    throw new Error(
      "O arquivo não contém um personagem válido.",
    )
  }

  if (
    parsed.format ===
      "dnd-manager-character" &&
    "character" in parsed
  ) {
    return {
      character: parsed.character,
      homebrewSpells: Array.isArray(
        parsed.homebrewSpells,
      )
        ? parsed.homebrewSpells.filter(
            isEmbeddedHomebrewSpell,
          )
        : [],
    }
  }

  return {
    character: parsed,
    homebrewSpells: [],
  }
}

function getMissingEmbeddedSpells(
  spells: Spell[],
  existingSpells: Map<string, Spell>,
): Spell[] {
  const missing = new Map<string, Spell>()

  for (const spell of spells) {
    if (existingSpells.has(spell.index)) {
      continue
    }

    if (missing.has(spell.index)) {
      continue
    }

    missing.set(spell.index, spell)
  }

  return Array.from(missing.values())
}

function isEmbeddedHomebrewSpell(
  value: unknown,
): value is Spell {
  if (!isRecord(value)) return false

  return (
    value.homebrew === true &&
    typeof value.index === "string" &&
    value.index.trim().length > 0 &&
    typeof value.name === "string"
  )
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
}