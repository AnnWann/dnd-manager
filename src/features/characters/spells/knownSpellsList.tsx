// features/characters/spells/KnownSpellsList.tsx

import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { CharacterClassInterface } from "../../../models/sheet/Class"
import { SpellCard } from "./spellCard"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

type KnownSpellLimitInfo = {
  className: string
  label: string
}

export function KnownSpellsList({
  character,
  updateCharacter,
}: Props) {
  const spells = character.getSpells()
  const classLimits = getKnownSpellClassLimits(character)

  function togglePrepared(spellIndex: string, prepared: boolean) {
    updateCharacter(character.get("id"), (c) =>
      c.setSpellPrepared(spellIndex, !prepared),
    )
  }

  function removeSpell(spellIndex: string) {
    updateCharacter(character.get("id"), (c) =>
      c.removeSpell(spellIndex),
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Magias conhecidas
        </div>

        <div className="mt-1 text-xs text-text">
          Magias adicionadas ao personagem.
        </div>

        {classLimits.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {classLimits.map((entry) => (
              <span
                key={entry.className}
                className="rounded-md border border-border px-2 py-1 text-xs text-text"
              >
                {entry.label}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {spells.length === 0 ? (
          <p className="text-xs text-text">
            Nenhuma magia adicionada.
          </p>
        ) : (
          <div className="grid gap-3">
            {spells.map((spell) => (
              <SpellCard
                key={spell.index}
                spell={spell}
                onTogglePrepared={() =>
                  togglePrepared(spell.index, spell.prepared)
                }
                onRemove={() => removeSpell(spell.index)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getKnownSpellClassLimits(
  character: CharacterTemplate,
): KnownSpellLimitInfo[] {
  if (character.get("sheet").type !== "pc") return []

  const spells = character.getSpells()
  const classes = character.get("sheet").classes ?? []

  return classes
    .map((classData): KnownSpellLimitInfo | null => {
      const limit = getClassKnownSpellLimit(classData)

      if (limit === undefined) return null

      const known = spells.filter(
        (spell) => spell.classes === classData.className,
      ).length

      if (isSpellbookCaster(classData)) {
        return {
          className: classData.className,
          label: `${classData.className}: ${known}/${limit}+ no grimório`,
        }
      }

      if (isLimitedKnownCaster(classData)) {
        return {
          className: classData.className,
          label: `${classData.className}: ${known}/${limit}`,
        }
      }

      return null
    })
    .filter((entry): entry is KnownSpellLimitInfo => entry !== null)
}

function getClassKnownSpellLimit(
  classData: CharacterClassInterface,
): number | undefined {
  const knownSpells = classData.knownSpells

  if (!knownSpells) return undefined

  const override = knownSpells.overrides?.[classData.level]
  if (override !== undefined) return override

  return (
    knownSpells.baseAtLevel1 +
    Math.max(0, classData.level - 1) * knownSpells.perLevel
  )
}

function isLimitedKnownCaster(
  classData: CharacterClassInterface,
): boolean {
  return classData.knownSpells?.mode === "limited"
}

function isSpellbookCaster(
  classData: CharacterClassInterface,
): boolean {
  return classData.knownSpells?.mode === "spellbook"
}