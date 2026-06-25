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
  accessLabel?: string
  onEdit?: () => void
  onRemove?: () => void
  onTogglePrepared?: () => void
}

export function SpellCard({
  spell,
  prepared = false,
  source,
  alwaysPrepared = false,
  accessLabel,
  onEdit,
  onRemove,
  onTogglePrepared,
}: Props) {
  const [isViewOpen, setIsViewOpen] = useState(false)
  const canTogglePrepared = Boolean(onTogglePrepared) && !alwaysPrepared
  const material = spell.material?.trim()

  return (
    <>
      <article className="rounded-2xl border border-border bg-bg p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold leading-snug text-textH sm:text-sm">
              {spell.displayName || spell.name}
            </h3>

            <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1.5 text-xs leading-5 text-text">
              <SpellMeta>
                {spell.slotLevel === 0 ? "Truque" : `Nível ${spell.slotLevel}`}
              </SpellMeta>
              <SpellMeta>
                {MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}
              </SpellMeta>
              <SpellMeta>{formatCastingTime(spell)}</SpellMeta>
              <SpellMeta>{formatRange(spell)}</SpellMeta>
              <SpellMeta className="font-medium text-textH">
                {formatComponentsCompact(spell)}
              </SpellMeta>
              {formatAreaTiles(spell) ? (
                <SpellMeta>{formatAreaTiles(spell)}</SpellMeta>
              ) : null}
              <SpellMeta>{formatSpellOrigin(source)}</SpellMeta>
              {accessLabel ? (
                <SpellMeta className="font-semibold text-accent">
                  {accessLabel}
                </SpellMeta>
              ) : null}
              {spell.concentration ? <SpellMeta>Concentração</SpellMeta> : null}
              {alwaysPrepared ? (
                <SpellMeta>Sempre disponível</SpellMeta>
              ) : prepared ? (
                <SpellMeta>Preparada</SpellMeta>
              ) : (
                <SpellMeta>Não preparada</SpellMeta>
              )}
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2 border-t border-border pt-3 sm:w-auto sm:shrink-0 sm:justify-end sm:border-0 sm:pt-0">
            <Button
              className="flex-1 sm:flex-none"
              size="sm"
              variant="secondary"
              onClick={() => setIsViewOpen(true)}
            >
              Visualizar
            </Button>

            {canTogglePrepared ? (
              <Button
                className="flex-1 sm:flex-none"
                size="sm"
                variant="secondary"
                onClick={onTogglePrepared}
              >
                {prepared ? "Despreparar" : "Preparar"}
              </Button>
            ) : null}

            {onEdit ? (
              <Button
                className="flex-1 sm:flex-none"
                size="sm"
                variant="secondary"
                onClick={onEdit}
              >
                Editar
              </Button>
            ) : null}

            {onRemove ? (
              <Button
                className="flex-1 sm:flex-none"
                size="sm"
                variant="ghost"
                onClick={onRemove}
              >
                Remover
              </Button>
            ) : null}
          </div>
        </div>

        {material ? (
          <div className="mt-3 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs leading-5 text-text">
            <span className="font-semibold text-textH">Material:</span>{" "}
            {material}
          </div>
        ) : null}

        {spell.description?.trim() ? (
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-text">
            {spell.description}
          </p>
        ) : null}
      </article>

      {isViewOpen ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-bg shadow-xl">
            <div className="flex flex-col gap-3 border-b border-accentBorder p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words font-heading text-lg text-textH">
                  {spell.displayName || spell.name}
                </h2>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs leading-5 text-text">
                  <SpellMeta>
                    {spell.slotLevel === 0 ? "Truque" : `Nível ${spell.slotLevel}`}
                  </SpellMeta>
                  <SpellMeta>
                    {MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}
                  </SpellMeta>
                  <SpellMeta>{formatCastingTime(spell)}</SpellMeta>
                  <SpellMeta>{formatRange(spell)}</SpellMeta>
                  <SpellMeta>{formatSpellOrigin(source)}</SpellMeta>
                  {accessLabel ? <SpellMeta>{accessLabel}</SpellMeta> : null}
                  {spell.concentration ? <SpellMeta>Concentração</SpellMeta> : null}
                  {spell.ritual ? <SpellMeta>Ritual</SpellMeta> : null}
                </div>
              </div>

              <Button
                className="w-full sm:w-auto"
                variant="secondary"
                size="sm"
                onClick={() => setIsViewOpen(false)}
              >
                Fechar
              </Button>
            </div>

            <div className="grid gap-4 p-4 text-sm text-text">
              <section className="rounded-xl border border-border bg-bg-subtle p-3">
                <h3 className="text-sm font-semibold text-textH">
                  Componentes
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {getSpellComponents(spell).length ? (
                    getSpellComponents(spell).map((component) => (
                      <span
                        key={component}
                        className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-xs font-medium text-textH"
                      >
                        {formatComponentLong(component)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-textMuted">
                      Nenhum componente informado.
                    </span>
                  )}
                </div>

                {material ? (
                  <div className="mt-3 text-xs leading-5 text-text">
                    <span className="font-semibold text-textH">
                      Componente material:
                    </span>{" "}
                    {material}
                  </div>
                ) : getSpellComponents(spell).includes("M") ? (
                  <div className="mt-3 text-xs text-textMuted">
                    A magia exige componente material, mas o material específico não foi informado.
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-textH">Descrição</h3>
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

function SpellMeta({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={`min-w-0 break-words ${className}`}>
      {children}
    </span>
  )
}

function getSpellComponents(spell: Spell): Array<"V" | "S" | "M"> {
  if (!Array.isArray(spell.components)) return []

  const order: Array<"V" | "S" | "M"> = ["V", "S", "M"]
  return order.filter((component) => spell.components.includes(component))
}

function formatComponentsCompact(spell: Spell): string {
  const components = getSpellComponents(spell)
  return components.length
    ? `Componentes: ${components.join(", ")}`
    : "Componentes: nenhum"
}

function formatComponentLong(component: "V" | "S" | "M"): string {
  if (component === "V") return "V — Verbal"
  if (component === "S") return "S — Somático"
  return "M — Material"
}

function formatCastingTime(spell: Spell): string {
  const castingTime = spell.castingTime
  if (castingTime.type === "special") return castingTime.special || "Especial"
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
  const names = {
    circle: "círculo",
    square: "quadrado",
    cone: "cone",
    line: "linha",
  }
  return names[shape] ?? shape
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
  if (source.type === "race") {
    return source.name ? `Origem: Raça (${source.name})` : "Origem: Raça"
  }
  if (source.type === "equipment") {
    return source.name
      ? `Origem: Equipamento (${source.name})`
      : "Origem: Equipamento"
  }
  return "Origem não definida"
}

function formatAreaTiles(spell: Spell): string | null {
  const area = spell.range.area
  if (!area) return null
  const sizeInTiles = area.size / 1.5
  if (area.shape === "circle") {
    return `Ocupa aproximadamente ${Math.round(Math.PI * sizeInTiles * sizeInTiles)} quadrados de 1,5 m`
  }
  if (area.shape === "square") {
    return `Ocupa aproximadamente ${Math.round(sizeInTiles * sizeInTiles)} quadrados de 1,5 m`
  }
  return null
}
