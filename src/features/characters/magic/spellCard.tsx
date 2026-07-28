import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { MarkdownText } from "../../../components/ui/MarkdownText"
import { Button } from "../../../components/ui/Button"
import {
  CASTING_TIME_NAMES,
  CLASS_NAMES,
  MAGIC_SCHOOLS_MAP,
} from "../../../contexts/consts"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { ClassName } from "../../../models/sheet/Class"

const MAX_CASTING_DESCRIPTIONS = 5
const MAX_CASTING_DESCRIPTION_LENGTH = 800

type Props = {
  spell: Spell
  prepared?: boolean
  source?: SpellSource
  alwaysPrepared?: boolean
  accessLabel?: string
  castingDescriptions?: string[]
  onAddCastingDescription?: () => void
  onChangeCastingDescription?: (index: number, description: string) => void
  onRemoveCastingDescription?: (index: number) => void
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
  castingDescriptions = [],
  onAddCastingDescription,
  onChangeCastingDescription,
  onRemoveCastingDescription,
  onEdit,
  onRemove,
  onTogglePrepared,
}: Props) {
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [castingDescriptionsOpen, setCastingDescriptionsOpen] = useState(
    castingDescriptions.length > 0,
  )
  const [draftCastingDescriptions, setDraftCastingDescriptions] =
    useState(castingDescriptions)
  const castingDescriptionsKey = castingDescriptions.join("\u0000")
  const canTogglePrepared = Boolean(onTogglePrepared) && !alwaysPrepared
  const canEditCastingDescriptions = Boolean(
    onAddCastingDescription &&
      onChangeCastingDescription &&
      onRemoveCastingDescription,
  )
  const canAddCastingDescription =
    canEditCastingDescriptions &&
    castingDescriptions.length < MAX_CASTING_DESCRIPTIONS
  const material = spell.material?.trim()
  const spellName = spell.displayName || spell.name

  useEffect(() => {
    setDraftCastingDescriptions(castingDescriptions)
  }, [spell.index, castingDescriptionsKey])

  useEffect(() => {
    if (!isViewOpen) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsViewOpen(false)
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [isViewOpen])

  function setDraftCastingDescription(index: number, description: string) {
    const nextDescription = description.slice(0, MAX_CASTING_DESCRIPTION_LENGTH)
    setDraftCastingDescriptions((current) => {
      const next = [...current]
      next[index] = nextDescription
      return next
    })
  }

  function commitCastingDescription(index: number) {
    const draft = draftCastingDescriptions[index] ?? ""
    if ((castingDescriptions[index] ?? "") === draft) return
    onChangeCastingDescription?.(index, draft)
  }

  const spellModal = isViewOpen
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${spellName}`}
          className="fixed inset-0 z-[12000] flex h-screen w-screen items-center justify-center bg-black/80 p-3 sm:p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsViewOpen(false)
          }}
        >
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-bg shadow-xl sm:max-h-[calc(100dvh-2rem)]">
            <header className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-accentBorder bg-bg/95 p-4 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words font-heading text-lg text-textH">
                  {spellName}
                </h2>

                {spell.displayName && spell.displayName !== spell.name ? (
                  <div className="mt-1 text-xs text-textMuted">
                    Nome original: {spell.name}
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs leading-5 text-text">
                  <SpellMeta>{formatSpellLevel(spell)}</SpellMeta>
                  <SpellMeta>
                    {MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}
                  </SpellMeta>
                  <SpellMeta>{formatSpellOrigin(source)}</SpellMeta>
                  <SpellMeta>
                    {formatPreparationStatus(prepared, alwaysPrepared)}
                  </SpellMeta>
                  {accessLabel ? <SpellMeta>{accessLabel}</SpellMeta> : null}
                </div>
              </div>

              <Button
                className="w-full shrink-0 sm:w-auto"
                variant="secondary"
                size="sm"
                onClick={() => setIsViewOpen(false)}
              >
                Fechar
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid gap-4 p-4 text-sm text-text">
                <section className="rounded-xl border border-border bg-bg-subtle p-3">
                  <h3 className="text-sm font-semibold text-textH">
                    Informações da magia
                  </h3>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Nível" value={formatSpellLevel(spell)} />
                    <DetailItem
                      label="Escola"
                      value={MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}
                    />
                    <DetailItem
                      label="Tempo de conjuração"
                      value={formatCastingTime(spell)}
                    />
                    <DetailItem label="Alcance" value={formatRange(spell)} />
                    <DetailItem label="Duração" value={formatDuration(spell)} />
                    <DetailItem label="Alvo" value={formatTargeting(spell)} />
                    <DetailItem label="Área" value={formatArea(spell)} />
                    <DetailItem
                      label="Ataque ou resistência"
                      value={formatAttackAndSave(spell)}
                    />
                    <DetailItem
                      label="Rolagens"
                      value={formatRollModes(spell)}
                    />
                    <DetailItem
                      label="Dano base"
                      value={formatDamageDice(spell)}
                    />
                    <DetailItem
                      label="Componentes"
                      value={formatComponentsCompact(spell).replace(
                        "Componentes: ",
                        "",
                      )}
                    />
                    <DetailItem
                      label="Concentração"
                      value={spell.concentration ? "Sim" : "Não"}
                    />
                    <DetailItem
                      label="Ritual"
                      value={spell.ritual ? "Sim" : "Não"}
                    />
                    <DetailItem label="Classes" value={formatClasses(spell)} />
                    <DetailItem
                      label="Origem"
                      value={formatSpellOrigin(source)}
                    />
                    <DetailItem
                      label="Disponibilidade"
                      value={
                        accessLabel ||
                        formatPreparationStatus(prepared, alwaysPrepared)
                      }
                    />
                    {source ? (
                      <DetailItem
                        label="Atributo de conjuração"
                        value={source.attribute.toUpperCase()}
                      />
                    ) : null}
                    {source?.extendedList ? (
                      <DetailItem label="Lista expandida" value="Sim" />
                    ) : null}
                    {formatAreaTiles(spell) ? (
                      <DetailItem
                        label="Área no grid"
                        value={formatAreaTiles(spell) || ""}
                      />
                    ) : null}
                  </div>
                </section>

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
                      A magia exige componente material, mas o material específico
                      não foi informado.
                    </div>
                  ) : null}
                </section>

                {castingDescriptions.length > 0 ? (
                  <section className="rounded-xl border border-border bg-bg-subtle p-3">
                    <h3 className="text-sm font-semibold text-textH">
                      Como o personagem conjura
                    </h3>
                    <div className="mt-2 grid gap-2">
                      {castingDescriptions.map((description, index) => (
                        <MarkdownText
                          key={index}
                          text={description}
                          emptyFallback="Descrição vazia."
                          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-6"
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {spell.headcanon?.trim() ? (
                  <section className="rounded-xl border border-border bg-bg-subtle p-3">
                    <h3 className="text-sm font-semibold text-textH">
                      Interpretação do personagem
                    </h3>
                    <MarkdownText
                      text={spell.headcanon}
                      className="mt-2 leading-6"
                    />
                  </section>
                ) : null}

                <section>
                  <h3 className="text-sm font-semibold text-textH">Descrição</h3>
                  <MarkdownText
                    text={spell.description}
                    emptyFallback="Sem descrição."
                    className="mt-2 leading-6"
                  />
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-textH">
                    Em níveis superiores
                  </h3>
                  <MarkdownText
                    text={spell.higherLevelText}
                    emptyFallback="Sem efeito adicional em níveis superiores."
                    className="mt-2 leading-6"
                  />
                </section>

                {Array.isArray(spell.effects) && spell.effects.length > 0 ? (
                  <section className="rounded-xl border border-border bg-bg-subtle p-3">
                    <h3 className="text-sm font-semibold text-textH">
                      Efeitos estruturados
                    </h3>
                    <div className="mt-2 grid gap-2">
                      {spell.effects.map((effect, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-border bg-bg px-3 py-2 text-xs leading-5"
                        >
                          <span className="font-semibold text-textH">
                            Efeito {index + 1}:
                          </span>{" "}
                          {formatEffect(effect)}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <article className="rounded-2xl border border-border bg-bg p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold leading-snug text-textH sm:text-sm">
              {spellName}
            </h3>

            <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1.5 text-xs leading-5 text-text">
              <SpellMeta>{formatSpellLevel(spell)}</SpellMeta>
              <SpellMeta>
                {MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}
              </SpellMeta>
              <SpellMeta>{formatCastingTime(spell)}</SpellMeta>
              <SpellMeta>{formatRange(spell)}</SpellMeta>
              <SpellMeta>{formatDuration(spell)}</SpellMeta>
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
              <SpellMeta>
                {formatPreparationStatus(prepared, alwaysPrepared)}
              </SpellMeta>
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
            {stripMarkdownForPreview(spell.description)}
          </p>
        ) : null}

        <details
          className="mt-3 rounded-xl border border-border bg-bg-subtle p-3"
          open={castingDescriptionsOpen}
          onToggle={(event) =>
            setCastingDescriptionsOpen(event.currentTarget.open)
          }
        >
          <summary className="cursor-pointer text-xs font-semibold text-textH">
            Como o personagem conjura
            {castingDescriptions.length > 0
              ? ` (${castingDescriptions.length})`
              : ""}
          </summary>

          <div className="mt-3 grid gap-3">
            <p className="text-xs leading-5 text-textMuted">
              Anote variações visuais, gestos, frases ou efeitos recorrentes dessa
              magia no personagem.
            </p>

            {draftCastingDescriptions.length > 0 ? (
              <div className="grid gap-2">
                {draftCastingDescriptions.map((description, index) => (
                  <div key={index} className="grid gap-2">
                    {canEditCastingDescriptions ? (
                      <textarea
                        className="min-h-20 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-5 text-textH outline-none transition-colors placeholder:text-textMuted focus:border-accent focus:ring-2 focus:ring-accent/25"
                        value={description}
                        maxLength={MAX_CASTING_DESCRIPTION_LENGTH}
                        placeholder="Ex.: a lâmina brilha em fogo azul antes do impacto..."
                        onChange={(event) =>
                          setDraftCastingDescription(index, event.target.value)
                        }
                        onBlur={() => commitCastingDescription(index)}
                      />
                    ) : (
                      <MarkdownText
                        text={description}
                        emptyFallback="Descrição vazia."
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-5 text-text"
                      />
                    )}

                    {canEditCastingDescriptions ? (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemoveCastingDescription?.(index)}
                        >
                          Remover descrição
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-textMuted">
                Nenhuma descrição personalizada ainda.
              </p>
            )}

            {canAddCastingDescription ? (
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onAddCastingDescription}
                >
                  + Adicionar descrição
                </Button>
              </div>
            ) : null}
          </div>
        </details>
      </article>

      {spellModal}
    </>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-textH">{value}</div>
    </div>
  )
}

function SpellMeta({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`min-w-0 break-words ${className}`}>
      {children}
    </span>
  )
}

function stripMarkdownForPreview(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-+*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/(\*\*\*|___)(.*?)\1/g, "$2")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/([*_])(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
}

function getSpellComponents(spell: Spell): Array<"V" | "S" | "M"> {
  if (!Array.isArray(spell.components)) return []

  const order: Array<"V" | "S" | "M"> = ["V", "S", "M"]
  return order.filter((component) => spell.components.includes(component))
}

function formatSpellLevel(spell: Spell): string {
  return spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º círculo`
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
  const label = CASTING_TIME_NAMES[castingTime.type] ?? castingTime.type
  return castingTime.value === 1
    ? `1 ${label}`
    : `${castingTime.value} ${label}s`
}

function formatRange(spell: Spell): string {
  const { range } = spell
  if (range.origin === "self") return "Pessoal"
  if (range.origin === "touch") return "Toque"

  const originLabels: Record<string, string> = {
    point: "Ponto",
    target: "Alvo",
    ally: "Aliado",
    enemy: "Inimigo",
  }
  const origin = originLabels[range.origin] ?? range.origin
  const base = range.distance > 0 ? `${origin}, ${range.distance} m` : origin
  if (!range.area) return base
  return `${base}; ${formatAreaShape(range.area.shape)} de ${range.area.size} m`
}

function formatDuration(spell: Spell): string {
  const { value, unit } = spell.duration
  const labels: Record<string, [string, string]> = {
    instantaneous: ["Instantânea", "Instantânea"],
    turn: ["turno", "turnos"],
    round: ["rodada", "rodadas"],
    minute: ["minuto", "minutos"],
    hour: ["hora", "horas"],
    day: ["dia", "dias"],
    special: ["Especial", "Especial"],
    untilDispelled: ["Até ser dissipada", "Até ser dissipada"],
    "short rest": [
      "Até o próximo descanso curto",
      "Até o próximo descanso curto",
    ],
    "long rest": [
      "Até o próximo descanso longo",
      "Até o próximo descanso longo",
    ],
    permanent: ["Permanente", "Permanente"],
  }
  const [singular, plural] = labels[unit] ?? [unit, unit]

  if (
    unit === "instantaneous" ||
    unit === "special" ||
    unit === "untilDispelled" ||
    unit === "short rest" ||
    unit === "long rest" ||
    unit === "permanent"
  ) {
    return singular
  }
  if (value <= 0) return singular
  return `${value} ${value === 1 ? singular : plural}`
}

function formatTargeting(spell: Spell): string {
  const target = spell.targeting
  const selfSuffix = target.targetsSelf ? "; pode afetar o conjurador" : ""

  if (target.kind === "self") return "Pessoal"
  if (target.kind === "single-creature") return `Uma criatura${selfSuffix}`
  if (target.kind === "multiple-creatures") {
    const count = target.targetCount
      ? `${target.targetCount} criaturas`
      : "Múltiplas criaturas"
    return `${count}${
      target.canTargetMoreAtHigherLevels
        ? "; mais alvos em níveis superiores"
        : ""
    }${selfSuffix}`
  }
  if (target.kind === "area") return formatArea(spell)
  if (target.kind === "object") return "Objeto"
  return "Especial"
}

function formatArea(spell: Spell): string {
  const area = spell.range.area
  if (area) return `${formatAreaShape(area.shape)} de ${area.size} m`

  if (spell.targeting.affectsArea) {
    if (spell.targeting.areaShape && spell.targeting.areaSize) {
      return `${formatAreaShape(spell.targeting.areaShape)} de ${
        spell.targeting.areaSize
      } m`
    }
    return "Área especial"
  }

  return "Não se aplica"
}

function formatAreaShape(shape: "circle" | "square" | "cone" | "line") {
  const names = {
    circle: "círculo",
    square: "quadrado",
    cone: "cone",
    line: "linha",
  }
  return names[shape] ?? shape
}

function formatAttackAndSave(spell: Spell): string {
  const parts: string[] = []
  if (spell.targeting.hasAttackRoll) parts.push("Jogada de ataque mágico")
  if (spell.targeting.hasSavingThrow) {
    parts.push(
      spell.targeting.savingThrowAttribute
        ? `Teste de resistência de ${spell.targeting.savingThrowAttribute.toUpperCase()}`
        : "Teste de resistência",
    )
  }
  return parts.length ? parts.join("; ") : "Nenhum"
}

function formatRollModes(spell: Spell): string {
  if (!spell.rollMode.length) return "Nenhuma"
  const labels: Record<string, string> = {
    attack: "Ataque",
    save: "Resistência",
    skill: "Perícia",
  }
  return spell.rollMode.map((mode) => labels[mode] ?? mode).join(", ")
}

function formatDamageDice(spell: Spell): string {
  if (!spell.damageDice) return "Não informado"
  return `${spell.damageDice.quantity}${spell.damageDice.sides}`
}

function formatClasses(spell: Spell): string {
  if (!spell.classes.length) return "Nenhuma classe padrão"
  return spell.classes
    .map((className) => CLASS_NAMES[className] ?? className)
    .join(", ")
}

function formatPreparationStatus(
  prepared: boolean,
  alwaysPrepared: boolean,
): string {
  if (alwaysPrepared) return "Sempre disponível"
  return prepared ? "Preparada" : "Não preparada"
}

function formatSpellOrigin(source?: SpellSource): string {
  if (!source) return "Origem não definida"
  if (source.type === "class") {
    const className = CLASS_NAMES[source.name as ClassName] ?? source.name
    return source.extendedList
      ? `Classe: ${className} — lista expandida`
      : `Classe: ${className}`
  }
  if (source.type === "feat") {
    return source.name ? `Talento: ${source.name}` : "Talento"
  }
  if (source.type === "ability") {
    return source.name ? `Habilidade: ${source.name}` : "Habilidade"
  }
  if (source.type === "race") {
    return source.name ? `Raça: ${source.name}` : "Raça"
  }
  if (source.type === "equipment") {
    return source.name ? `Equipamento: ${source.name}` : "Equipamento"
  }
  return "Origem não definida"
}

function formatAreaTiles(spell: Spell): string | null {
  const area = spell.range.area
  if (!area) return null
  const sizeInTiles = area.size / 1.5
  if (area.shape === "circle") {
    return `Aproximadamente ${Math.round(
      Math.PI * sizeInTiles * sizeInTiles,
    )} quadrados de 1,5 m`
  }
  if (area.shape === "square") {
    return `Aproximadamente ${Math.round(
      sizeInTiles * sizeInTiles,
    )} quadrados de 1,5 m`
  }
  if (area.shape === "line") {
    return `Linha de aproximadamente ${Math.max(
      1,
      Math.round(sizeInTiles),
    )} quadrados`
  }
  return `Cone de ${area.size} m`
}

function formatEffect(effect: Spell["effects"][number]): string {
  const data = effect as unknown as Record<string, unknown>
  const parts: string[] = []

  if (typeof data.target === "string" && data.target.trim()) {
    parts.push(`alvo: ${data.target}`)
  }
  const rollDice = formatUnknownDie(data.rollDice)
  if (rollDice) parts.push(`rolagem: ${rollDice}`)
  if (Array.isArray(data.rollAppliesTo) && data.rollAppliesTo.length) {
    parts.push(`aplica-se a: ${data.rollAppliesTo.map(String).join(", ")}`)
  }
  if (typeof data.attribute === "string") {
    parts.push(`atributo: ${data.attribute.toUpperCase()}`)
  }
  if (typeof data.condition === "string") {
    parts.push(`condição: ${data.condition}`)
  }
  if (typeof data.value === "number") {
    const operation =
      typeof data.operation === "string" ? ` (${data.operation})` : ""
    parts.push(`valor: ${data.value}${operation}`)
  }
  if (typeof data.when === "string") parts.push(`quando: ${data.when}`)
  const damageDice = formatUnknownDie(data.damageDice)
  if (damageDice) parts.push(`dano: ${damageDice}`)
  if (typeof data.directionText === "string" && data.directionText.trim()) {
    parts.push(`movimento: ${data.directionText}`)
  }
  if (typeof data.type === "string") parts.push(`tipo: ${data.type}`)

  return parts.length ? parts.join("; ") : "Dados adicionais não informados."
}

function formatUnknownDie(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  const die = value as Record<string, unknown>
  if (typeof die.quantity !== "number" || typeof die.sides !== "string") {
    return undefined
  }
  return `${die.quantity}${die.sides}`
}
