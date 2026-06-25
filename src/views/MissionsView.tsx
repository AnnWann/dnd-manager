import { useEffect, useMemo, useState } from "react"
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
  Search,
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

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR")
  const filteredMissions = useMemo(
    () =>
      missions.filter((mission) => {
        if (!normalizedSearch) return true

        const searchable = [
          mission.title,
          mission.summary,
          mission.description,
          mission.giver,
          mission.location,
          mission.reward,
          mission.notes,
          ...mission.tags,
          ...mission.objectives.map((objective) => objective.text),
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")

        return searchable.includes(normalizedSearch)
      }),
    [missions, normalizedSearch],
  )

  const missionCounts = {
    available: missions.filter((mission) => mission.status === "available").length,
    accepted: missions.filter((mission) => mission.status === "accepted").length,
    completed: missions.filter((mission) => mission.status === "completed").length,
  }

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
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(STATUS_CONFIG) as MissionStatus[]).map((status) => {
              const config = STATUS_CONFIG[status]
              const Icon = config.icon

              return (
                <div
                  key={status}
                  className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle p-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xl font-bold text-textH">
                      {missionCounts[status]}
                    </div>
                    <div className="text-xs text-textMuted">{config.label}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, objetivo, local, contratante ou recompensa..."
            />
          </label>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        {(Object.keys(STATUS_CONFIG) as MissionStatus[]).map((status) => (
          <MissionColumn
            key={status}
            status={status}
            missions={filteredMissions.filter(
              (mission) => mission.status === status,
            )}
            canManageMissions={canManageMissions}
            onEdit={setEditing}
            onDelete={(mission) => {
              if (
                window.confirm(
                  `Excluir permanentemente a missão “${mission.title}”?`,
                )
              ) {
                deleteMission(mission.id)
              }
            }}
            onMove={moveMission}
            onToggleObjective={toggleObjective}
          />
        ))}
      </div>

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

function MissionColumn({
  status,
  missions,
  canManageMissions,
  onEdit,
  onDelete,
  onMove,
  onToggleObjective,
}: {
  status: MissionStatus
  missions: Mission[]
  canManageMissions: boolean
  onEdit: (mission: Mission) => void
  onDelete: (mission: Mission) => void
  onMove: (missionId: string, status: MissionStatus) => void
  onToggleObjective: (missionId: string, objectiveId: string) => void
}) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-bg">
      <header className="border-b border-border bg-bg-subtle p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Icon className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-textH">
              {config.label}
            </h2>
          </div>
          <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-textH">
            {missions.length}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-textMuted">
          {config.description}
        </p>
      </header>

      <div className="grid gap-3 p-3">
        {missions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-textMuted">
            {config.empty}
          </div>
        ) : (
          missions
            .toSorted(compareMissions)
            .map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                canManageMissions={canManageMissions}
                onEdit={() => onEdit(mission)}
                onDelete={() => onDelete(mission)}
                onMove={(nextStatus) => onMove(mission.id, nextStatus)}
                onToggleObjective={(objectiveId) =>
                  onToggleObjective(mission.id, objectiveId)
                }
              />
            ))
        )}
      </div>
    </section>
  )
}

function MissionCard({
  mission,
  canManageMissions,
  onEdit,
  onDelete,
  onMove,
  onToggleObjective,
}: {
  mission: Mission
  canManageMissions: boolean
  onEdit: () => void
  onDelete: () => void
  onMove: (status: MissionStatus) => void
  onToggleObjective: (objectiveId: string) => void
}) {
  const completedObjectives = mission.objectives.filter(
    (objective) => objective.completed,
  ).length
  const objectivePercent = mission.objectives.length
    ? (completedObjectives / mission.objectives.length) * 100
    : 0

  return (
    <article className="rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={mission.priority} />
            {mission.recommendedLevel ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-textMuted">
                Nível {mission.recommendedLevel}+
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 break-words text-sm font-semibold leading-5 text-textH">
            {mission.title}
          </h3>

          {mission.summary ? (
            <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-text">
              {mission.summary}
            </p>
          ) : null}
        </div>

        {canManageMissions ? (
          <div className="flex shrink-0 gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Editar missão"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-danger"
              title="Excluir missão"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {(mission.giver || mission.location || mission.deadline) ? (
        <div className="mt-3 grid gap-1.5 text-[11px] text-textMuted">
          {mission.giver ? (
            <span className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" />
              {mission.giver}
            </span>
          ) : null}
          {mission.location ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {mission.location}
            </span>
          ) : null}
          {mission.deadline ? (
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Prazo: {formatDateTime(mission.deadline)}
            </span>
          ) : null}
        </div>
      ) : null}

      {mission.reward ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-accentBorder bg-accentBg p-2.5 text-xs text-textH">
          <Coins className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Recompensa
            </div>
            <div className="mt-0.5 whitespace-pre-wrap leading-5">
              {mission.reward}
            </div>
          </div>
        </div>
      ) : null}

      {mission.objectives.length ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-textH">Objetivos</span>
            <span className="text-textMuted">
              {completedObjectives}/{mission.objectives.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${objectivePercent}%` }}
            />
          </div>
          <div className="mt-2 grid gap-1.5">
            {mission.objectives.map((objective) => (
              <button
                key={objective.id}
                type="button"
                className="flex items-start gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-bg-subtle"
                onClick={() => onToggleObjective(objective.id)}
              >
                {objective.completed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-textMuted" />
                )}
                <span
                  className={
                    objective.completed
                      ? "text-textMuted line-through"
                      : "text-text"
                  }
                >
                  {objective.text || "Objetivo sem descrição"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mission.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mission.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle px-2 py-1 text-[10px] text-textMuted"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {(mission.description || mission.notes || mission.acceptedBy) ? (
        <details className="mt-3 rounded-lg border border-border bg-bg-subtle">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-textH">
            Ver detalhes
          </summary>
          <div className="grid gap-3 border-t border-border p-3 text-xs leading-5 text-text">
            {mission.description ? (
              <div>
                <div className="font-semibold text-textH">Descrição</div>
                <p className="mt-1 whitespace-pre-wrap">{mission.description}</p>
              </div>
            ) : null}
            {mission.notes ? (
              <div>
                <div className="font-semibold text-textH">Notas</div>
                <p className="mt-1 whitespace-pre-wrap">{mission.notes}</p>
              </div>
            ) : null}
            {mission.acceptedBy ? (
              <div className="text-textMuted">
                Aceita por {mission.acceptedBy}
                {mission.acceptedAt
                  ? ` em ${formatDateTime(mission.acceptedAt)}`
                  : ""}
              </div>
            ) : null}
            {mission.completedAt ? (
              <div className="text-textMuted">
                Concluída em {formatDateTime(mission.completedAt)}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        {mission.status === "available" ? (
          <Button
            className="flex-1"
            size="sm"
            variant="primary"
            onClick={() => onMove("accepted")}
          >
            <Check className="h-4 w-4" />
            Aceitar missão
          </Button>
        ) : null}

        {mission.status === "accepted" ? (
          <>
            <Button
              className="flex-1"
              size="sm"
              variant="primary"
              onClick={() => onMove("completed")}
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onMove("available")}
            >
              Devolver
            </Button>
          </>
        ) : null}

        {mission.status === "completed" && canManageMissions ? (
          <Button
            className="flex-1"
            size="sm"
            variant="secondary"
            onClick={() => onMove("accepted")}
          >
            <ArchiveRestore className="h-4 w-4" />
            Reabrir
          </Button>
        ) : null}
      </div>
    </article>
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

function PriorityBadge({ priority }: { priority: MissionPriority }) {
  const classes: Record<MissionPriority, string> = {
    low: "border-border bg-bg-subtle text-textMuted",
    normal: "border-accentBorder bg-accentBg text-textH",
    high: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    urgent: "border-danger/50 bg-dangerBg text-danger",
  }

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
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
