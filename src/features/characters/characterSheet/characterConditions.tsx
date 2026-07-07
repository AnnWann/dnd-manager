import { useEffect, useState } from "react"
import { Clock3, Plus, RotateCcw, Tag, Trash2 } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type { CharacterCondition, ConditionDurationType } from "../../../models/characters/CharacterCondition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  addCharacterCondition,
  adjustConditionRemaining,
  getCharacterConditions,
  removeCharacterCondition,
  updateCharacterCondition,
} from "../../../models/characters/characterConditionStorage"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

const NUMERIC_DURATION_TYPES = new Set<ConditionDurationType>([
  "rounds",
  "turns",
  "minutes",
  "hours",
  "days",
])

const DURATION_OPTIONS: Array<{
  value: ConditionDurationType
  label: string
}> = [
  { value: "rounds", label: "Rodadas" },
  { value: "turns", label: "Turnos" },
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
  { value: "until-start-of-turn", label: "Até o início do turno" },
  { value: "until-end-of-turn", label: "Até o fim do turno" },
  { value: "until-save", label: "Até passar em um teste" },
  { value: "concentration", label: "Enquanto houver concentração" },
  { value: "permanent", label: "Permanente" },
  { value: "custom", label: "Duração personalizada" },
]

export function CharacterConditions({
  character,
  updateCharacter,
}: Props) {
  const conditions = getCharacterConditions(character)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CharacterCondition | null>(null)

  function saveCondition(condition: CharacterCondition) {
    updateCharacter(character.get("id"), (current) =>
      editing
        ? updateCharacterCondition(current, condition)
        : addCharacterCondition(current, condition),
    )
    setCreating(false)
    setEditing(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-textH">
                Condições
              </div>
              <div className="mt-1 text-xs text-textMuted">
                Efeitos temporários, estados persistentes e comportamentos que poderão acompanhar os turnos na iniciativa.
              </div>
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreating(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Adicionar condição
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {conditions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
              Nenhuma condição ativa.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {conditions.map((condition) => {
                const numeric = NUMERIC_DURATION_TYPES.has(condition.duration.type)
                const remaining = condition.duration.remaining
                const expired = numeric && remaining === 0

                return (
                  <article
                    key={condition.id}
                    className={[
                      "rounded-xl border p-3",
                      expired
                        ? "border-danger/40 bg-danger/5"
                        : "border-border bg-bg-subtle",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-sm font-semibold text-textH">
                            {condition.name}
                          </h3>
                          {expired ? (
                            <span className="rounded-full border border-danger/40 px-2 py-0.5 text-[10px] font-semibold text-danger">
                              Expirada
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-textMuted">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDuration(condition)}
                          </span>
                          {condition.source ? (
                            <span>Fonte: {condition.source}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditing(condition)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Remover condição"
                          onClick={() =>
                            updateCharacter(character.get("id"), (current) =>
                              removeCharacterCondition(current, condition.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {condition.behavior ? (
                      <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg p-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                          Comportamento
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-textH">
                          {condition.behavior}
                        </p>
                      </div>
                    ) : null}

                    {condition.description ? (
                      <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-text">
                        {condition.description}
                      </p>
                    ) : null}

                    {condition.tags.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {condition.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-1 text-[10px] text-textMuted"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {numeric && typeof remaining === "number" ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg p-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-textMuted">
                            Tempo restante
                          </div>
                          <div className="text-sm font-semibold text-textH">
                            {remaining} de {condition.duration.total ?? remaining}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={remaining <= 0}
                            onClick={() =>
                              updateCharacter(character.get("id"), (current) =>
                                adjustConditionRemaining(current, condition.id, -1),
                              )
                            }
                          >
                            −1
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateCharacter(character.get("id"), (current) =>
                                adjustConditionRemaining(current, condition.id, 1),
                              )
                            }
                          >
                            +1
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Restaurar duração inicial"
                            onClick={() =>
                              updateCharacter(character.get("id"), (current) =>
                                updateCharacterCondition(current, {
                                  ...condition,
                                  duration: {
                                    ...condition.duration,
                                    remaining:
                                      condition.duration.total ?? remaining,
                                  },
                                }),
                              )
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConditionDialog
        open={creating || editing !== null}
        condition={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSave={saveCondition}
      />
    </>
  )
}

function ConditionDialog({
  open,
  condition,
  onClose,
  onSave,
}: {
  open: boolean
  condition: CharacterCondition | null
  onClose: () => void
  onSave: (condition: CharacterCondition) => void
}) {
  const [draft, setDraft] = useState<CharacterCondition>(() =>
    condition ?? createCondition(),
  )

  useEffect(() => {
    if (!open) return
    setDraft(condition ?? createCondition())
  }, [condition, open])

  if (!open) return null

  const numeric = NUMERIC_DURATION_TYPES.has(draft.duration.type)

  function patch(patchValue: Partial<CharacterCondition>) {
    setDraft((current) => ({ ...current, ...patchValue }))
  }

  function patchDuration(
    patchValue: Partial<CharacterCondition["duration"]>,
  ) {
    setDraft((current) => ({
      ...current,
      duration: {
        ...current.duration,
        ...patchValue,
      },
    }))
  }

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto bg-black/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="my-auto grid max-h-[calc(100dvh-1rem)] w-full max-w-3xl gap-4 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-textH">
              {condition ? "Editar condição" : "Adicionar condição"}
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              O comportamento descreve o efeito mecânico; a duração prepara o efeito para avançar em turnos futuramente.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs text-text">Nome</span>
            <Input
              value={draft.name}
              placeholder="Ex.: Amedrontado"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Fonte</span>
            <Input
              value={draft.source}
              placeholder="Ex.: magia Medo, veneno, criatura"
              onChange={(event) => patch({ source: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Comportamento mecânico</span>
            <Textarea
              rows={3}
              value={draft.behavior}
              placeholder="Ex.: desvantagem em ataques enquanto enxergar a fonte; não pode se aproximar voluntariamente."
              onChange={(event) => patch({ behavior: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Descrição</span>
            <Textarea
              rows={2}
              value={draft.description}
              placeholder="Descrição narrativa ou contexto da condição."
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Duração</span>
            <Select
              value={draft.duration.type}
              onChange={(event) => {
                const type = event.target.value as ConditionDurationType
                const becomesNumeric = NUMERIC_DURATION_TYPES.has(type)
                patchDuration({
                  type,
                  total: becomesNumeric ? draft.duration.total ?? 1 : undefined,
                  remaining: becomesNumeric
                    ? draft.duration.remaining ?? draft.duration.total ?? 1
                    : undefined,
                })
              }}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          {numeric ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1.5">
                <span className="text-xs text-text">Total</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.duration.total ?? 1}
                  onChange={(event) => {
                    const total = Math.max(0, Number(event.target.value) || 0)
                    patchDuration({
                      total,
                      remaining: Math.min(
                        draft.duration.remaining ?? total,
                        total,
                      ),
                    })
                  }}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs text-text">Restante</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.duration.remaining ?? draft.duration.total ?? 1}
                  onChange={(event) =>
                    patchDuration({
                      remaining: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                />
              </label>
            </div>
          ) : null}

          {draft.duration.type === "custom" ? (
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs text-text">Texto da duração</span>
              <Input
                value={draft.duration.customLabel ?? ""}
                placeholder="Ex.: até abandonar o templo"
                onChange={(event) =>
                  patchDuration({ customLabel: event.target.value })
                }
              />
            </label>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Quando reduzir</span>
            <Select
              value={draft.duration.tickOn ?? "end-of-turn"}
              onChange={(event) =>
                patchDuration({
                  tickOn: event.target.value as CharacterCondition["duration"]["tickOn"],
                })
              }
            >
              <option value="start-of-turn">Início do turno</option>
              <option value="end-of-turn">Fim do turno</option>
              <option value="manual">Somente manualmente</option>
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Turno de referência</span>
            <Select
              value={draft.duration.tickOwner ?? "affected"}
              onChange={(event) =>
                patchDuration({
                  tickOwner: event.target.value as CharacterCondition["duration"]["tickOwner"],
                })
              }
            >
              <option value="affected">Personagem afetado</option>
              <option value="source">Fonte da condição</option>
            </Select>
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={draft.duration.autoRemoveAtZero !== false}
              onChange={(event) =>
                patchDuration({ autoRemoveAtZero: event.target.checked })
              }
            />
            <span>
              <span className="font-medium text-textH">
                Remover automaticamente ao chegar a zero
              </span>
              <span className="mt-0.5 block text-textMuted">
                Esta opção será usada automaticamente pelo futuro controlador de turnos.
              </span>
            </span>
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Etiquetas</span>
            <Input
              value={draft.tags.join(", ")}
              placeholder="Ex.: mental, medo, magia, debilitante"
              onChange={(event) =>
                patch({
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Notas</span>
            <Textarea
              rows={2}
              value={draft.notes}
              onChange={(event) => patch({ notes: event.target.value })}
            />
          </label>

          <details className="rounded-lg border border-border bg-bg-subtle p-3 sm:col-span-2">
            <summary className="cursor-pointer text-xs font-medium text-textH">
              Integração futura com iniciativa
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs text-text">ID da fonte</span>
                <Input
                  value={draft.sourceCharacterId ?? ""}
                  placeholder="Opcional"
                  onChange={(event) =>
                    patch({ sourceCharacterId: event.target.value || undefined })
                  }
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs text-text">ID do combatente vinculado</span>
                <Input
                  value={draft.linkedCombatantId ?? ""}
                  placeholder="Preenchido futuramente"
                  onChange={(event) =>
                    patch({ linkedCombatantId: event.target.value || undefined })
                  }
                />
              </label>
            </div>
          </details>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!draft.name.trim()}
            onClick={() => onSave(draft)}
          >
            Salvar condição
          </Button>
        </div>
      </div>
    </div>
  )
}

function createCondition(): CharacterCondition {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    behavior: "",
    source: "",
    notes: "",
    tags: [],
    createdAt: new Date().toISOString(),
    duration: {
      type: "rounds",
      total: 1,
      remaining: 1,
      tickOn: "end-of-turn",
      tickOwner: "affected",
      autoRemoveAtZero: true,
    },
  }
}

function formatDuration(condition: CharacterCondition): string {
  const { duration } = condition

  if (NUMERIC_DURATION_TYPES.has(duration.type)) {
    const value = duration.remaining ?? duration.total ?? 0
    return `${value} ${durationUnitLabel(duration.type, value)}`
  }

  const labels: Record<Exclude<ConditionDurationType, "rounds" | "turns" | "minutes" | "hours" | "days">, string> = {
    "until-start-of-turn": "Até o início do turno",
    "until-end-of-turn": "Até o fim do turno",
    "until-save": "Até passar em um teste",
    concentration: "Enquanto houver concentração",
    permanent: "Permanente",
    custom: duration.customLabel?.trim() || "Duração personalizada",
  }

  return labels[duration.type as keyof typeof labels]
}

function durationUnitLabel(type: ConditionDurationType, value: number): string {
  if (type === "rounds") return value === 1 ? "rodada" : "rodadas"
  if (type === "turns") return value === 1 ? "turno" : "turnos"
  if (type === "minutes") return value === 1 ? "minuto" : "minutos"
  if (type === "hours") return value === 1 ? "hora" : "horas"
  return value === 1 ? "dia" : "dias"
}
