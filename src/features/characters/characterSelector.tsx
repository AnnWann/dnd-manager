import { useMemo, useRef, useState } from "react"
import { Download, Upload } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { useCharacterContext } from "../../contexts/characterContext"
import { useMagicContext } from "../../contexts/magicContext"
import type { Ability } from "../../models/abilities/Ability"
import { getCharacterGrantedSpells } from "../../models/characters/characterGrantedSpells"
import type {
  CharacterTemplate,
  CharacterTemplateProps,
} from "../../models/characters/CharacterTemplate"
import type { Equipment } from "../../models/items/equipment/EquipmentSlot"
import type { Itemmable } from "../../models/items/item"
import type { Spell } from "../../models/magic/spells/Spell"

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
  const { getSpellByIndex, spellByIndex, saveSpell } = useMagicContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState("")
  const [selectedCharacterId, setLocalSelectedCharacterId] = useState(
    activeCharacter.get("id"),
  )
  const [openCandidateId, setOpenCandidateId] = useState("")

  const selectedCharacter = useMemo(
    () =>
      characters.find(
        (character) => character.get("id") === selectedCharacterId,
      ) ?? activeCharacter,
    [activeCharacter, characters, selectedCharacterId],
  )

  function selectOrOpenCharacter(characterId: string) {
    if (openCandidateId === characterId) {
      setOpenCandidateId("")
      setActiveCharacterId(characterId)
      return
    }

    setLocalSelectedCharacterId(characterId)
    setSelectedCharacterId(characterId)
    setOpenCandidateId(characterId)
  }

  function exportSelectedCharacter() {
    const referencedSpellIndexes =
      collectReferencedSpellIndexes(selectedCharacter)

    const homebrewSpells = Array.from(referencedSpellIndexes)
      .map((spellIndex) => getSpellByIndex(spellIndex))
      .filter((spell): spell is Spell => Boolean(spell?.homebrew))

    const bundle: CharacterExportBundle = {
      format: "dnd-manager-character",
      version: 2,
      character: selectedCharacter.toJSON(),
      homebrewSpells,
    }

    const json = JSON.stringify(bundle, null, 2)
    const blob = new Blob([json], { type: "application/json" })
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

      for (const spell of getMissingEmbeddedSpells(
        bundle.homebrewSpells,
        spellByIndex,
      )) {
        saveSpell(spell)
      }

      const imported = importCharacter(bundle.character)
      const importedId = imported.get("id")
      setLocalSelectedCharacterId(importedId)
      setSelectedCharacterId(importedId)
      setOpenCandidateId(importedId)
      setImportError("")
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o personagem.",
      )
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function confirmDeleteSelectedCharacter() {
    if (disableDelete) return

    const characterName =
      selectedCharacter.get("name").trim() || "personagem selecionado"
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir permanentemente “${characterName}”?\n\nEssa ação não pode ser desfeita. Exporte o JSON antes se quiser manter uma cópia.`,
    )

    if (confirmed) {
      setSelectedCharacterId(selectedCharacter.get("id"))
      deleteActiveCharacter()
      setOpenCandidateId("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-textH">Personagens</div>
            <p className="mt-1 text-xs text-text">
              Clique uma vez para selecionar e novamente para abrir a ficha.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Importar JSON
            </Button>

            <Button size="sm" variant="primary" onClick={addCharacter}>
              + Adicionar
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) =>
            void importFromFile(event.target.files?.[0])
          }
        />

        {importError ? (
          <div className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {importError}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          {characters.map((character) => {
            const id = character.get("id")
            const name = character.get("name")
            const sheet = character.get("sheet")
            const visibility = character.get("visibility")
            const owner = character.get("owner")
            const isSelected = id === selectedCharacter.get("id")
            const isReadyToOpen = openCandidateId === id
            const classes = sheet.classes ?? []
            const level = classes.reduce(
              (total, entry) => total + (entry.level ?? 0),
              0,
            )
            const spellCount = getAvailableSpellCount(
              character,
              getSpellByIndex,
            )

            return (
              <button
                key={id}
                type="button"
                className={
                  isSelected
                    ? "flex w-full items-center justify-between rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-left"
                    : "flex w-full items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-left hover:bg-[color:var(--social-bg)]"
                }
                onClick={() => selectOrOpenCharacter(id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-textH">
                    {name}
                  </div>
                  <div className="text-xs text-text">
                    {spellCount > 0 ? `${spellCount} magias • ` : ""}
                    {level} nv
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {showOwnerBadge
                    ? badge(
                        visibility === "master"
                          ? "Master"
                          : `Player: ${owner?.name?.trim() || "sem nome"}`,
                      )
                    : null}
                  {isReadyToOpen
                    ? badge("Clique novamente para abrir")
                    : isSelected
                      ? badge("Selecionado")
                      : null}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-3">
          <Button
            className="w-full"
            variant="secondary"
            onClick={confirmDeleteSelectedCharacter}
            disabled={disableDelete}
            title={
              disableDelete
                ? "Mantenha pelo menos 1 personagem"
                : "Excluir personagem selecionado"
            }
          >
            Excluir personagem selecionado
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function getAvailableSpellCount(
  character: CharacterTemplate,
  getSpellByIndex: (spellIndex: string) => Spell | undefined,
): number {
  const indexes = new Set<string>()

  for (const knownSpell of
    character.get("magic")?.spells.knownSpells ?? []) {
    addSpellIndex(indexes, knownSpell.spells.id)
  }

  for (const grantedSpell of getCharacterGrantedSpells(character)) {
    addSpellIndex(indexes, grantedSpell.index)
  }

  return Array.from(indexes).filter((index) =>
    Boolean(getSpellByIndex(index)),
  ).length
}

function collectReferencedSpellIndexes(
  character: CharacterTemplate,
): Set<string> {
  const indexes = new Set<string>()

  for (const knownSpell of
    character.get("magic")?.spells.knownSpells ?? []) {
    addSpellIndex(indexes, knownSpell.spells.id)
  }

  for (const ability of character.get("abilities") ?? []) {
    collectAbilitySpellIndexes(indexes, ability)
  }

  for (const ability of
    character.get("sheet").race.naturalAbilities ?? []) {
    collectAbilitySpellIndexes(indexes, ability)
  }

  const equipment = character.get("equipment")
  const equippedItems: Array<Itemmable | undefined> = [
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
    if (item) collectItemSpellIndexes(indexes, item)
  }

  for (const item of character.get("inventory")) {
    collectItemSpellIndexes(indexes, item)
  }

  return indexes
}

function collectAbilitySpellIndexes(
  indexes: Set<string>,
  ability: Ability,
) {
  for (const grant of ability.grantedSpells ?? []) {
    addSpellIndex(indexes, grant.index)
  }
}

function collectItemSpellIndexes(
  indexes: Set<string>,
  item: Itemmable,
) {
  const equipment = item as Itemmable &
    Partial<Pick<Equipment, "abilities" | "spells">>

  for (const spell of equipment.spells ?? []) {
    addSpellIndex(indexes, spell.index)
  }

  for (const ability of equipment.abilities ?? []) {
    collectAbilitySpellIndexes(indexes, ability)
  }
}

function addSpellIndex(indexes: Set<string>, index?: string) {
  const normalized = index?.trim()
  if (normalized) indexes.add(normalized)
}

function parseCharacterExport(parsed: unknown): {
  character: unknown
  homebrewSpells: Spell[]
} {
  if (!isRecord(parsed)) {
    throw new Error("O arquivo não contém um personagem válido.")
  }

  if (
    parsed.format === "dnd-manager-character" &&
    "character" in parsed
  ) {
    return {
      character: parsed.character,
      homebrewSpells: Array.isArray(parsed.homebrewSpells)
        ? parsed.homebrewSpells.filter(isEmbeddedHomebrewSpell)
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
  const uniqueMissingSpells = new Map<string, Spell>()

  for (const spell of spells) {
    if (existingSpells.has(spell.index)) continue
    if (uniqueMissingSpells.has(spell.index)) continue
    uniqueMissingSpells.set(spell.index, spell)
  }

  return Array.from(uniqueMissingSpells.values())
}

function isEmbeddedHomebrewSpell(value: unknown): value is Spell {
  if (!isRecord(value)) return false

  return (
    value.homebrew === true &&
    typeof value.index === "string" &&
    value.index.trim().length > 0 &&
    typeof value.name === "string"
  )
}

function isRecord(value: unknown): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
}

function badge(label: string) {
  return (
    <span className="rounded-md border border-border px-2 py-1 text-xs text-text">
      {label}
    </span>
  )
}
