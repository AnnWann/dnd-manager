import { useRef } from "react"

import { Button } from "../../../components/ui/Button"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import { SpellCard } from "./spellCard"

type Props = {
  spell: Spell
  source: SpellSource
  prepared: boolean
  alwaysPrepared: boolean
  accessLabel?: string
  castingDescriptions?: string[]
}

export function CompactSpellCard({
  spell,
  source,
  prepared,
  alwaysPrepared,
  accessLabel,
  castingDescriptions = [],
}: Props) {
  const hiddenCardRef = useRef<HTMLDivElement | null>(null)
  const spellName = spell.displayName || spell.name

  function openDetails() {
    hiddenCardRef.current
      ?.querySelector<HTMLButtonElement>("article button")
      ?.click()
  }

  return (
    <>
      <article className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2">
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

function formatSpellLevel(spell: Spell): string {
  return spell.slotLevel === 0 ? "Truque" : `Nível ${spell.slotLevel}`
}
