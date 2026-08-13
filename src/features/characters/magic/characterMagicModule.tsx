// features/characters/spells/CharacterSpellsModule.tsx

import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { useCharacterContext } from "../../../contexts/characterContext"
import { useMagicContext } from "../../../contexts/magicContext"
import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getSorcererLevel } from "../../../models/characters/characterSorceryPoints"
import type { CharacterSpells } from "../../../models/magic/spells/CharacterSpells"
import type { Spell, SpellResourceType } from "../../../models/magic/spells/Spell"
import type {
  CharacterClassInterface,
  ClassName,
} from "../../../models/sheet/Class"
import { ChannelDivinityModule } from "./channelDivinityModule"
import { KiModule } from "./kiModule"
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

type KnownSpellEntry = CharacterSpells["knownSpells"][number]
type ResourceMode = "inherit" | "slots" | SpellResourceType

const DIVINE_PREPARED_CLASSES: readonly ClassName[] = [
  "cleric",
  "druid",
  "paladin",
]

export function CharacterMagicTab({
  character,
  updateCharacter,
}: Props) {
  const { visibleCharacters } = useCharacterContext()
  const { spells, getSpellByIndex } = useMagicContext()
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const sorcererLevel = getSorcererLevel(character)
  const hasSorcererResources = sorcererLevel >= 2
  const spellListText = useMemo(
    () => buildAllCharacterSpellList(visibleCharacters, getSpellByIndex),
    [getSpellByIndex, visibleCharacters],
  )
  const canCopySpellList = spellListText.trim().length > 0

  useEffect(() => {
    const missingSpells = getMissingDivineClassSpells(character, spells)
    if (missingSpells.length === 0) return

    updateCharacter(character.get("id"), (current) => {
      let nextCharacter = current

      for (const spellEntry of missingSpells) {
        nextCharacter = nextCharacter.addSpell(spellEntry)
      }

      return nextCharacter
    })
  }, [character, spells, updateCharacter])

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

        <ChannelDivinityModule
          character={character}
          updateCharacter={updateCharacter}
        />

        <KiModule
          character={character}
          updateCharacter={updateCharacter}
        />

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

        <SpellResourceOverrides
          character={character}
          updateCharacter={updateCharacter}
          getSpellByIndex={getSpellByIndex}
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

function SpellResourceOverrides({
  character,
  updateCharacter,
  getSpellByIndex,
}: Props & { getSpellByIndex: (spellIndex: string) => Spell | undefined }) {
  const availableSpells = useMemo(() => {
    const byId = new Map<string, Spell>()

    for (const entry of character.get("magic")?.spells.knownSpells ?? []) {
      const spell = getSpellByIndex(entry.spells.id)
      if (spell) byId.set(spell.index, spell)
    }

    for (const grant of getCharacterGrantedSpells(character)) {
      const spell = getSpellByIndex(grant.index)
      if (spell) byId.set(spell.index, spell)
    }

    return Array.from(byId.values()).toSorted((left, right) =>
      left.slotLevel - right.slotLevel ||
      (left.displayName || left.name).localeCompare(
        right.displayName || right.name,
        "pt-BR",
      ),
    )
  }, [character, getSpellByIndex])

  if (!availableSpells.length) return null

  const overrides = character.get("magic")?.spells.resourceCostOverrides ?? {}

  function setResourceMode(spell: Spell, mode: ResourceMode) {
    updateCharacter(character.get("id"), (current) => {
      const magic = current.getOrCreateMagic()
      const nextOverrides = { ...(magic.spells.resourceCostOverrides ?? {}) }

      if (mode === "inherit") {
        delete nextOverrides[spell.index]
      } else if (mode === "slots") {
        nextOverrides[spell.index] = null
      } else {
        const previous = nextOverrides[spell.index]
        nextOverrides[spell.index] = {
          resource: mode,
          amount:
            previous && previous.resource === mode
              ? previous.amount
              : 1,
        }
      }

      return current.with("magic", {
        ...magic,
        spells: {
          ...magic.spells,
          resourceCostOverrides: nextOverrides,
        },
      })
    })
  }

  function setResourceAmount(spell: Spell, amount: number) {
    updateCharacter(character.get("id"), (current) => {
      const magic = current.getOrCreateMagic()
      const nextOverrides = { ...(magic.spells.resourceCostOverrides ?? {}) }
      const currentOverride = nextOverrides[spell.index]
      if (!currentOverride) return current

      nextOverrides[spell.index] = {
        ...currentOverride,
        amount: Math.max(1, Math.trunc(amount) || 1),
      }

      return current.with("magic", {
        ...magic,
        spells: {
          ...magic.spells,
          resourceCostOverrides: nextOverrides,
        },
      })
    })
  }

  return (
    <section className="border-t border-border px-4 py-4">
      <div className="text-sm font-semibold text-textH">
        Recurso de conjuração por magia
      </div>
      <div className="mt-1 text-xs text-text">
        Configuração exclusiva deste personagem. Ela sobrescreve o padrão da magia; sem sobrescrita, a magia usa sua configuração global ou espaços normalmente.
      </div>

      <div className="mt-3 grid gap-2">
        {availableSpells.map((spell) => {
          const hasOverride = Object.prototype.hasOwnProperty.call(
            overrides,
            spell.index,
          )
          const override = overrides[spell.index]
          const mode: ResourceMode = !hasOverride
            ? "inherit"
            : override === null
              ? "slots"
              : override.resource

          return (
            <div
              key={spell.index}
              className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3 md:grid-cols-[minmax(0,1fr)_220px_100px] md:items-end"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-textH">
                  {spell.displayName || spell.name}
                </div>
                <div className="mt-1 text-[11px] text-textMuted">
                  {spell.slotLevel === 0 ? "Truque" : `Nível ${spell.slotLevel}`}
                  {" • padrão: "}
                  {spell.resourceCost
                    ? `${resourceLabel(spell.resourceCost.resource)} ${spell.resourceCost.amount}`
                    : "espaço de magia"}
                </div>
              </div>

              <label className="grid gap-1 text-[11px] text-textMuted">
                Recurso
                <select
                  className="h-10 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-textH outline-none"
                  value={mode}
                  onChange={(event) =>
                    setResourceMode(spell, event.target.value as ResourceMode)
                  }
                >
                  <option value="inherit">Padrão da magia</option>
                  <option value="slots">Espaço de magia</option>
                  <option value="ki">Ki</option>
                  <option value="sorceryPoints">Pontos de magia</option>
                  <option value="channelDivinity">Canalizar Divindade</option>
                </select>
              </label>

              {override ? (
                <label className="grid gap-1 text-[11px] text-textMuted">
                  Custo
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={override.amount}
                    onChange={(event) =>
                      setResourceAmount(spell, Number(event.target.value))
                    }
                  />
                </label>
              ) : (
                <div />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function resourceLabel(resource: SpellResourceType): string {
  if (resource === "ki") return "Ki"
  if (resource === "sorceryPoints") return "Pontos de magia"
  return "Canalizar Divindade"
}

function getMissingDivineClassSpells(
  character: CharacterTemplate,
  availableSpells: Spell[],
): KnownSpellEntry[] {
  const knownSpellIds = new Set(
    (character.get("magic")?.spells.knownSpells ?? []).map(
      (entry) => entry.spells.id,
    ),
  )
  const missingSpells: KnownSpellEntry[] = []
  const classes = character.get("sheet").classes ?? []

  for (const classData of classes) {
    if (!isDivinePreparedCaster(classData)) continue

    const maximumSpellLevel = getMaximumDivineSpellLevel(classData)
    if (maximumSpellLevel < 1) continue

    for (const spell of availableSpells) {
      if (
        knownSpellIds.has(spell.index) ||
        spell.slotLevel < 1 ||
        spell.slotLevel > maximumSpellLevel ||
        !spell.classes.includes(classData.className)
      ) {
        continue
      }

      missingSpells.push({
        source: {
          type: "class",
          name: classData.className,
          sourceId: classData.className,
          attribute:
            classData.castingAttribute ??
            (classData.className === "paladin" ? "cha" : "wis"),
        },
        spells: {
          id: spell.index,
          prepared: false,
        },
      })
      knownSpellIds.add(spell.index)
    }
  }

  return missingSpells
}

function isDivinePreparedCaster(
  classData: CharacterClassInterface,
): classData is CharacterClassInterface & {
  className: "cleric" | "druid" | "paladin"
} {
  return (
    DIVINE_PREPARED_CLASSES.includes(classData.className) &&
    classData.knownSpells?.mode === "prepared-only"
  )
}

function getMaximumDivineSpellLevel(
  classData: CharacterClassInterface & {
    className: "cleric" | "druid" | "paladin"
  },
): number {
  if (classData.className === "paladin") {
    if (classData.level < 2) return 0
    return Math.min(5, Math.ceil(classData.level / 4))
  }

  return Math.min(9, Math.ceil(classData.level / 2))
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
