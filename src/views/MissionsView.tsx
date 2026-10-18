import { MissionCard } from "../../packages/game-ui/src/MissionCard"
import { MissionBoardToolbar } from "../../packages/game-ui/src/MissionBoardToolbar"
import { MissionBoard } from "../../packages/game-ui/src/MissionBoard"
import { filterMissions, countMissionsByStatus } from "../../packages/game-core/src/missionBoard"
import { useEffect, useState } from "react"
import {
  ArchiveRestore,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  Coins,
  Flag,
  MapPin,
  Pencil,
  Plus,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react"

import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { Select } from "../components/ui/Select"
import { Textarea } from "../components/ui/Textarea"
import { useMissions } from "../contexts/missionContext"
import {
  createEmptyMission,
  type Mission,
  type MissionObjective,
  type MissionPriority,
  type MissionStatus,
} from "../models/missions/Mission"

const STATUS_CONFIG: Record<
  MissionStatus,
  {
    label: string
    description: string
    icon: typeof Flag
    empty: string
  }
> = {
  available: {
    label: "Disponíveis",
    description: "Oportunidades que o grupo ainda pode aceitar.",
    icon: Flag,
    empty: "Nenhuma missão disponível.",
  },
  accepted: {
    label: "Aceitas",
    description: "Missões atualmente assumidas pelo grupo.",
    icon: ClipboardCheck,
    empty: "Nenhuma missão aceita.",
  },
  completed: {
    label: "Concluídas",
    description: "Histórico das missões finalizadas.",
    icon: CheckCircle2,
    empty: "Nenhuma missão concluída.",
  },
}

const PRIORITY_LABELS: Record<MissionPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
}

export function MissionsView() {
  const {
    missions,
    canManageMissions,
    addMission,
    updateMission,
    deleteMission,
    moveMission,
    toggleObjective,
  } = useMissions()
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Mission | null>(null)

  const filteredMissions = filterMissions(missions, search)
  const missionCounts = countMissionsByStatus(missions)

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="font-heading text-xl font-semibold text-textH">
                Missões
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-textMuted">
                Organize oportunidades disponíveis, acompanhe objetivos assumidos e mantenha o histórico das aventuras concluídas.
              </p>
            </div>

            {canManageMissions ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                Nova missão
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <MissionBoardToolbar
            statuses={(Object.keys(STATUS_CONFIG) as MissionStatus[]).map((status) => {
              const config = STATUS_CONFIG[status]
              const Icon = config.icon
              return { status, label: config.label, count: missionCounts[status], icon: <Icon className="h-5 w-5" /> }
            })}
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por título, objetivo, local, contratante ou recompensa..."
          />
        </CardContent>
      </Card>

      <MissionBoard
        columns={(Object.keys(STATUS_CONFIG) as MissionStatus[]).map((status) => {
          const config = STATUS_CONFIG[status]
          const Icon = config.icon
          return {
            status,
            label: config.label,
            description: config.description,
            emptyMessage: config.empty,
            icon: <Icon className="h-5 w-5 text-accent" />,
            items: filteredMissions.filter((mission) => mission.status === status).toSorted(compareMissions),
          }
        })}
        getItemKey={(mission) => mission.id}
        renderItem={(mission) => (
          <MissionCard
            ActionButton={Button}
            mission={mission}
            canManageMissions={canManageMissions}
            onEdit={() => setEditing(mission)}
            onDelete={() => {
              if (window.confirm(`Excluir permanentemente a missão “${mission.title}”?`)) {
                deleteMission(mission.id)
              }
            }}
            onMove={(status) => moveMission(mission.id, status)}
            onToggleObjective={(objectiveId) => toggleObjective(mission.id, objectiveId)}
          />
        )}
      />

      <MissionDialog
        open={creating || editing !== null}
        mission={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSave={(mission) => {
          if (editing) {
            updateMission(editing.id, () => mission)
          } else {
            addMission(mission)
          }

          setCreating(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function MissionDialog({
  open,
  mission,
  onClose,
  onSave,
}: {
  open: boolean
  mission: Mission | null
  onClose: () => void
  onSave: (mission: Mission) => void
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
        { id: crypto.randomUUID(), text: "", completed: false },
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
              onChange={(event) => patch({ title: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Resumo</span>
            <Textarea
              rows={2}
              value={draft.summary}
              placeholder="Uma descrição curta para o cartão da missão."
              onChange={(event) => patch({ summary: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Descrição completa</span>
            <Textarea
              rows={4}
              value={draft.description}
              placeholder="Contexto, informações conhecidas e detalhes importantes."
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Contratante</span>
            <Input
              value={draft.giver}
              placeholder="NPC, facção ou organização"
              onChange={(event) => patch({ giver: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Local</span>
            <Input
              value={draft.location}
              placeholder="Região ou destino"
              onChange={(event) => patch({ location: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Recompensa</span>
            <Textarea
              rows={2}
              value={draft.reward}
              placeholder="Ouro, itens, favores, informação ou outros benefícios."
              onChange={(event) => patch({ reward: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Estado inicial</span>
            <Select
              value={draft.status}
              onChange={(event) =>
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
              onChange={(event) =>
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
              onChange={(event) => {
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
              onChange={(event) =>
                patch({ deadline: event.target.value || undefined })
              }
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Etiquetas</span>
            <Input
              value={draft.tags.join(", ")}
              placeholder="Ex.: Phandalin, urgente, investigação"
              onChange={(event) =>
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
                      onChange={(event) =>
                        updateObjective(objective.id, (current) => ({
                          ...current,
                          completed: event.target.checked,
                        }))
                      }
                    />
                    <Input
                      value={objective.text}
                      placeholder={`Objetivo ${index + 1}`}
                      onChange={(event) =>
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
              onChange={(event) => patch({ notes: event.target.value })}
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

function compareMissions(left: Mission, right: Mission): number {
  const priorityWeight: Record<MissionPriority, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  }
  const priorityDifference =
    priorityWeight[right.priority] - priorityWeight[left.priority]

  if (priorityDifference !== 0) return priorityDifference

  const leftDeadline = left.deadline
    ? new Date(left.deadline).getTime()
    : Number.POSITIVE_INFINITY
  const rightDeadline = right.deadline
    ? new Date(right.deadline).getTime()
    : Number.POSITIVE_INFINITY

  if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline

  return left.title.localeCompare(right.title, "pt-BR")
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
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
