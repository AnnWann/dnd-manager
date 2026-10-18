import type { ComponentType } from "react"
import { ArchiveRestore, Check, CheckCircle2, Circle, Clock3, Coins, MapPin, Pencil, Tag, Trash2, UserRound } from "lucide-react"
import type { Mission, MissionStatus, MissionPriority } from "../../session-protocol/src/mission"

const PRIORITY_LABELS: Record<MissionPriority, string> = {
  low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente",
}

export function MissionCard({
  mission,
  canManageMissions,
  onEdit,
  onDelete,
  onMove,
  onToggleObjective,
  ActionButton,
}: {
  mission: Mission
  canManageMissions: boolean
  onEdit: () => void
  onDelete: () => void
  onMove: (status: MissionStatus) => void
  onToggleObjective: (objectiveId: string) => void
  ActionButton: ComponentType<any>
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
            <ActionButton
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Editar missão"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-danger"
              title="Excluir missão"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </ActionButton>
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
          <ActionButton
            className="flex-1"
            size="sm"
            variant="primary"
            onClick={() => onMove("accepted")}
          >
            <Check className="h-4 w-4" />
            Aceitar missão
          </ActionButton>
        ) : null}

        {mission.status === "accepted" ? (
          <>
            <ActionButton
              className="flex-1"
              size="sm"
              variant="primary"
              onClick={() => onMove("completed")}
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </ActionButton>
            <ActionButton
              size="sm"
              variant="secondary"
              onClick={() => onMove("available")}
            >
              Devolver
            </ActionButton>
          </>
        ) : null}

        {mission.status === "completed" && canManageMissions ? (
          <ActionButton
            className="flex-1"
            size="sm"
            variant="secondary"
            onClick={() => onMove("accepted")}
          >
            <ArchiveRestore className="h-4 w-4" />
            Reabrir
          </ActionButton>
        ) : null}
      </div>
    </article>
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

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

