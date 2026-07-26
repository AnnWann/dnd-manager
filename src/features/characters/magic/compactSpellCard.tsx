import { useRef } from "react"

import { Button } from "../../../components/ui/Button"
import { CLASS_NAMES } from "../../../contexts/consts"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { ClassName } from "../../../models/sheet/Class"
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

  function openDetails() {
    hiddenCardRef.current
      ?.querySelector<HTMLButtonElement>("article button")
      ?.click()
  }

  return (
    <>
      <article className="grid gap-3 rounded-xl border border-border bg-bg px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-textMuted sm:hidden">
            Nome
          </div>
          <div className="break-words text-sm font-semibold text-textH">
            {spell.displayName || spell.name}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-textMuted sm:hidden">
            Nível
          </div>
          <div className="text-sm text-text">{formatSpellLevel(spell)}</div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-textMuted sm:hidden">
            Origem
          </div>
          <div className="break-words text-sm text-text">
            {formatSpellOrigin(source)}
          </div>
        </div>

        <Button size="sm" variant="secondary" onClick={openDetails}>
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
  return spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º círculo`
}

function formatSpellOrigin(source: SpellSource): string {
  if (source.type === "class") {
    const className = CLASS_NAMES[source.name as ClassName] ?? source.name
    return source.extendedList
      ? `Classe: ${className} (lista expandida)`
      : `Classe: ${className}`
  }

  if (source.type === "ability") {
    return `Habilidade: ${source.name || "Sem nome"}`
  }

  if (source.type === "feat") {
    return `Talento: ${source.name || "Sem nome"}`
  }

  if (source.type === "race") {
    return `Raça: ${source.name || "Sem nome"}`
  }

  return `Equipamento: ${source.name || "Sem nome"}`
}
