import { useRef } from "react"

import { Button } from "../../../components/ui/Button"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { CharacterClassInterface } from "../../../models/sheet/Class"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { SpellCard } from "./spellCard"

type Props = {
  spell: Spell
  source: SpellSource
  prepared: boolean
  alwaysPrepared: boolean
  availableAsRitual: boolean
  accessLabel?: string
  castingDescriptions?: string[]
}

export function CompactSpellCard({
  spell,
  source,
  prepared,
  alwaysPrepared,
  availableAsRitual,
  accessLabel,
  castingDescriptions = [],
}: Props) {
  const hiddenCardRef = useRef<HTMLDivElement | null>(null)
  const { activeCharacter, updateCharacter } = useCharacterWorkspace()
  const { getSpellByIndex } = useMagicContext()
  const spellName = spell.displayName || spell.name
  const canTogglePrepared = !alwaysPrepared && Boolean(activeCharacter)
  const preparationDisabled =
    canTogglePrepared &&
    !prepared &&
    activeCharacter !== undefined &&
    !canPrepareSpell(activeCharacter, source, getSpellByIndex)

  function openDetails() {
    hiddenCardRef.current
      ?.querySelector<HTMLButtonElement>("article button")
      ?.click()
  }

  function togglePrepared(nextPrepared: boolean) {
    if (!activeCharacter || !canTogglePrepared || preparationDisabled) return

    updateCharacter(activeCharacter.get("id"), (current) =>
      current.setSpellPrepared(spell.index, nextPrepared),
    )
  }

  return (
    <>
      <article className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2">
        {canTogglePrepared ? (
          <input
            className="h-4 w-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-50"
            type="checkbox"
            checked={prepared}
            disabled={preparationDisabled}
            aria-label={`${prepared ? "Despreparar" : "Preparar"} ${spellName}`}
            title={
              preparationDisabled
                ? "Limite de magias preparadas atingido"
                : prepared
                  ? "Despreparar magia"
                  : "Preparar magia"
            }
            onChange={(event) => togglePrepared(event.target.checked)}
          />
        ) : null}

        <div
          className="min-w-0 flex-1 truncate text-sm font-semibold text-textH"
          title={spellName}
        >
          {spellName}
        </div>

        <span className="shrink-0 text-xs text-textMuted" aria-hidden="true">
          —
        </span>

        <div className="shrink-0 whitespace-nowrap text-xs text-text">
          {formatSpellLevel(spell)}
        </div>

        {availableAsRitual ? (
          <span
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-accentBorder bg-accentBg px-1 text-[10px] font-bold text-accent"
            title="Disponível como ritual"
            aria-label="Disponível como ritual"
          >
            R
          </span>
        ) : null}

        <span className="shrink-0 text-xs text-textMuted" aria-hidden="true">
          —
        </span>

        <Button
          className="shrink-0"
          size="sm"
          variant="secondary"
          onClick={openDetails}
        >
          Visualizar
        </Button>
      </article>

      <div ref={hiddenCardRef} className="hidden" aria-hidden="true">
        <SpellCard
          spell={spell}
          source={source}
          prepared={prepared}
          alwaysPrepared={alwaysPrepared}
          accessLabel={accessLabel}
          castingDescriptions={castingDescriptions}
        />
      </div>
    </>
  )
}

function canPrepareSpell(
  character: CharacterTemplate,
  source: SpellSource,
  getSpellByIndex: (spellIndex: string) => Spell | undefined,
): boolean {
  if (source.type !== "class") return true

  const classData = (character.get("sheet").classes ?? []).find(
    (entry) => entry.className === source.name,
  )
  if (!classData?.knownSpells?.canPrepare) return true

  const limit = getPreparedSpellLimit(character, classData)
  if (limit === undefined) return true

  const preparedCount = (
    character.get("magic")?.spells.knownSpells ?? []
  ).filter((entry) => {
    if (
      !entry.spells.prepared ||
      entry.source.type !== "class" ||
      entry.source.name !== source.name
    ) {
      return false
    }

    const knownSpell = getSpellByIndex(entry.spells.id)
    return Boolean(knownSpell && knownSpell.slotLevel > 0)
  }).length

  return preparedCount < limit
}

function getPreparedSpellLimit(
  character: CharacterTemplate,
  classData: CharacterClassInterface,
): number | undefined {
  if (!classData.knownSpells) return undefined

  const mode = classData.knownSpells.mode
  if (mode !== "prepared-only" && mode !== "spellbook") return undefined

  const modifier = classData.castingAttribute
    ? character.getEffectiveAttributeModifier(classData.castingAttribute)
    : 0

  switch (classData.className) {
    case "artificer":
      return Math.max(1, Math.floor(classData.level / 2) + modifier)
    case "cleric":
    case "druid":
    case "wizard":
      return Math.max(1, classData.level + modifier)
    case "paladin":
      return Math.max(1, Math.floor(classData.level / 2) + modifier)
    default:
      return undefined
  }
}

function formatSpellLevel(spell: Spell): string {
  return spell.slotLevel === 0 ? "Truque" : `Nível ${spell.slotLevel}`
}
