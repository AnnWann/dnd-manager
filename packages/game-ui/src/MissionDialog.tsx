import { useEffect, useState, type ChangeEvent, type ComponentType } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { Mission, MissionObjective, MissionPriority, MissionStatus } from "../../session-protocol/src/mission"

export function MissionDialog({
  open,
  mission,
  onClose,
  onSave,
  createEmptyMission,
  createObjectiveId,
  Button,
  Input,
  Select,
  Textarea,
}: {
  open: boolean
  mission: Mission | null
  onClose: () => void
  onSave: (mission: Mission) => void
  createEmptyMission: () => Mission
  createObjectiveId: () => string
  Button: ComponentType<any>
  Input: ComponentType<any>
  Select: ComponentType<any>
  Textarea: ComponentType<any>
}) {
  const [draft, setDraft] = useState<Mission>(() =>
    mission ? structuredClone(mission) : createEmptyMission(),
  )

  useEffect(() => {
    if (!open) return
    setDraft(mission ? structuredClone(mission) : createEmptyMission())
  }, [mission, open])

  if (!open) return null

  function patch(value: Partial<Mission>) {
    setDraft((current) => ({ ...current, ...value }))
  }

  function addObjective() {
    patch({
      objectives: [
        ...draft.objectives,
        { id: createObjectiveId(), text: "", completed: false },
      ],
    })
  }

  function updateObjective(
    objectiveId: string,
    updater: (objective: MissionObjective) => MissionObjective,
  ) {
    patch({
      objectives: draft.objectives.map((objective) =>
        objective.id === objectiveId ? updater(objective) : objective,
      ),
    })
  }

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center overflow-y-auto bg-black/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="my-auto grid max-h-[calc(100dvh-1rem)] w-full max-w-4xl gap-4 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">
              {mission ? "Editar missão" : "Nova missão"}
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Cadastre informações que serão compartilhadas com todo o grupo.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Título</span>
            <Input
              value={draft.title}
              placeholder="Ex.: Encontrar a entrada da Ecocaverna"
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch({ title: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Resumo</span>
            <Textarea
              rows={2}
              value={draft.summary}
              placeholder="Uma descrição curta para o cartão da missão."
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch({ summary: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Descrição completa</span>
            <Textarea
              rows={4}
              value={draft.description}
              placeholder="Contexto, informações conhecidas e detalhes importantes."
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch({ description: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Contratante</span>
            <Input
              value={draft.giver}
              placeholder="NPC, facção ou organização"
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch({ giver: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Local</span>
            <Input
              value={draft.location}
              placeholder="Região ou destino"
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch({ location: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Recompensa</span>
            <Textarea
              rows={2}
              value={draft.reward}
              placeholder="Ouro, itens, favores, informação ou outros benefícios."
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch({ reward: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Estado inicial</span>
            <Select
              value={draft.status}
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                patch({ status: event.target.value as MissionStatus })
              }
            >
              <option value="available">Disponível</option>
              <option value="accepted">Aceita</option>
              <option value="completed">Concluída</option>
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Prioridade</span>
            <Select
              value={draft.priority}
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                patch({ priority: event.target.value as MissionPriority })
              }
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Nível recomendado</span>
            <Input
              type="number"
              min={1}
              max={20}
              value={draft.recommendedLevel ?? ""}
              placeholder="Opcional"
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                const value = Number(event.target.value)
                patch({
                  recommendedLevel: Number.isFinite(value) && value > 0
                    ? Math.min(20, Math.trunc(value))
                    : undefined,
                })
              }}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Prazo</span>
            <Input
              type="datetime-local"
              value={toDateTimeLocalValue(draft.deadline)}
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                patch({ deadline: event.target.value || undefined })
              }
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Etiquetas</span>
            <Input
              value={draft.tags.join(", ")}
              placeholder="Ex.: Phandalin, urgente, investigação"
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                patch({
                  tags: Array.from(
                    new Set(
                      event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    ),
                  ),
                })
              }
            />
          </label>

          <div className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-textH">Objetivos</div>
                <div className="mt-0.5 text-[11px] text-textMuted">
                  O grupo poderá marcar cada objetivo diretamente no cartão.
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={addObjective}>
                <Plus className="h-4 w-4" />
                Objetivo
              </Button>
            </div>

            {draft.objectives.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-textMuted">
                Nenhum objetivo cadastrado.
              </div>
            ) : (
              <div className="grid gap-2">
                {draft.objectives.map((objective, index) => (
                  <div
                    key={objective.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={objective.completed}
                      title="Objetivo concluído"
                      onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                        updateObjective(objective.id, (current) => ({
                          ...current,
                          completed: event.target.checked,
                        }))
                      }
                    />
                    <Input
                      value={objective.text}
                      placeholder={`Objetivo ${index + 1}`}
                      onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                        updateObjective(objective.id, (current) => ({
                          ...current,
                          text: event.target.value,
                        }))
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-danger"
                      title="Remover objetivo"
                      onClick={() =>
                        patch({
                          objectives: draft.objectives.filter(
                            (current) => current.id !== objective.id,
                          ),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Notas do grupo</span>
            <Textarea
              rows={3}
              value={draft.notes}
              placeholder="Pistas, decisões, contatos e outras anotações."
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch({ notes: event.target.value })}
            />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!draft.title.trim()}
            onClick={() => onSave(draft)}
          >
            Salvar missão
          </Button>
        </div>
      </div>
    </div>
  )
}

function toDateTimeLocalValue(value?: string): string {
  if (!value) return ""
  if (!value.includes("Z") && !/[+-]\d\d:\d\d$/.test(value)) {
    return value.slice(0, 16)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

