import { MissionDialog } from "../../packages/game-ui/src/MissionDialog"
import { MissionCard } from "../../packages/game-ui/src/MissionCard"
import { MissionBoardToolbar } from "../../packages/game-ui/src/MissionBoardToolbar"
import { MissionBoard } from "../../packages/game-ui/src/MissionBoard"
import { filterMissions, countMissionsByStatus } from "../../packages/game-core/src/missionBoard"
import { useEffect, useState } from "react"
import {
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Plus,
  Trash2,
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
          Button={Button}
          Input={Input}
          Select={Select}
          Textarea={Textarea}
          createEmptyMission={createEmptyMission}
          createObjectiveId={() => crypto.randomUUID()}
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
