import { useState } from "react"
import { Button } from "../../../components/ui/Button"
import {
  CASTING_TIME_NAMES,
  CLASS_NAMES,
  MAGIC_SCHOOLS_MAP,
} from "../../../contexts/consts"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { ClassName } from "../../../models/sheet/Class"

type Props = {
  spell: Spell
  prepared?: boolean
  source?: SpellSource
  alwaysPrepared?: boolean
  onEdit?: () => void
  onRemove?: () => void
  onTogglePrepared?: () => void
}

export function SpellCard({
  spell,
  prepared = false,
  source,
  alwaysPrepared = false,
  onEdit,
  onRemove,
  onTogglePrepared,
}: Props) {
  const [isViewOpen, setIsViewOpen] = useState(false)

  return (
    <>
      <div className="rounded-2xl border border-border bg-bg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-textH">
              {spell.displayName || spell.name}
            </div>

            <div className="mt-1 flex flex-wrap gap-2 text-xs text-text">
              <span>Nível {spell.slotLevel}</span>
              <span>{MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}</span>
              <span>{formatCastingTime(spell)}</span>
              <span>{formatRange(spell)}</span>
              <span>{formatSpellOrigin(source)}</span>
              {spell.concentration ? <span>Concentração</span> : null}
              {alwaysPrepared ? (
                <span>Sempre preparada</span>
              ) : prepared ? (
                <span>Preparada</span>
              ) : (
                <span>Não preparada</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsViewOpen(true)}
            >
              Visualizar
            </Button>

            {onTogglePrepared && !alwaysPrepared ? (
              <Button size="sm" variant="secondary" onClick={onTogglePrepared}>
                {prepared ? "Despreparar" : "Preparar"}
              </Button>
            ) : null}

            {onEdit ? (
              <Button size="sm" variant="secondary" onClick={onEdit}>
                Editar
              </Button>
            ) : null}

            {onRemove ? (
              <Button size="sm" variant="ghost" onClick={onRemove}>
                Remover
              </Button>
            ) : null}
          </div>
        </div>

        {spell.description?.trim() ? (
          <div className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-text">
            {spell.description}
          </div>
        ) : null}
      </div>

      {isViewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-accentBorder p-4">
              <div>
                <h2 className="font-heading text-lg text-textH">
                  {spell.displayName || spell.name}
                </h2>

                <div className="mt-1 flex flex-wrap gap-2 text-xs text-text">
                  <span>Nível {spell.slotLevel}</span>
                  <span>{MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}</span>
                  <span>{formatCastingTime(spell)}</span>
                  <span>{formatRange(spell)}</span>
                  <span>{formatSpellOrigin(source)}</span>
                  {spell.concentration ? <span>Concentração</span> : null}
                  {spell.ritual ? <span>Ritual</span> : null}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsViewOpen(false)}
              >
                Fechar
              </Button>
            </div>

            <div className="grid gap-4 p-4 text-sm text-text">
              <section>
                <h3 className="text-sm font-semibold text-textH">
                  Descrição
                </h3>

                <div className="mt-2 whitespace-pre-wrap break-words leading-6">
                  {spell.description?.trim() || "Sem descrição."}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-textH">
                  Próximos níveis
                </h3>

                <div className="mt-2 whitespace-pre-wrap break-words leading-6">
                  {spell.higherLevelText?.trim() ||
                    "Sem efeito adicional em níveis superiores."}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function formatCastingTime(spell: Spell): string {
  const castingTime = spell.castingTime

  if (castingTime.type === "special") {
    return castingTime.special || "Especial"
  }

  if (castingTime.type === "reaction") {
    return castingTime.reactionWhen
      ? `Reação: ${castingTime.reactionWhen}`
      : "Reação"
  }

  if (castingTime.value === 1) {
    return `1 ${CASTING_TIME_NAMES[castingTime.type]}`
  }

  return `${castingTime.value} ${CASTING_TIME_NAMES[castingTime.type]}s`
}

function formatRange(spell: Spell): string {
  const { range } = spell

  if (range.origin === "self") return "Pessoal"
  if (range.origin === "touch") return "Toque"

  const base = `${range.distance} m`

  if (!range.area) return base

  return `${base}, ${formatAreaShape(range.area.shape)} de ${range.area.size} m`
}

function formatAreaShape(shape: NonNullable<Spell["range"]["area"]>["shape"]) {
  switch (shape) {
    case "circle":
      return "círculo"
    case "square":
      return "quadrado"
    case "cone":
      return "cone"
    case "line":
      return "linha"
    default:
      return shape
  }
}

function formatSpellOrigin(source?: SpellSource): string {
  if (!source) return "Origem não definida"

  if (source.type === "class") {
    return `Origem: ${CLASS_NAMES[source.name as ClassName] ?? source.name}`
  }

  if (source.type === "feat") {
    return source.name ? `Origem: Talento (${source.name})` : "Origem: Talento"
  }

  if (source.type === "ability") {
    return source.name
      ? `Origem: Habilidade (${source.name})`
      : "Origem: Habilidade"
  }

  return "Origem não definida"
}