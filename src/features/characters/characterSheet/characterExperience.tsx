import { Award, Flag, Gauge, Minus, Plus } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getExperienceProgress } from "../../../models/characters/characterExperience"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import {
  getCustomProgressionSummary,
  normalizeCampaignProgressionSettings,
  type CampaignProgressionPointSystem,
  type CampaignProgressionSettings,
  type CampaignProgressionTrack,
} from "../../../shared/progression/campaignProgression"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterExperience({
  character,
  updateCharacter,
}: Props) {
  const { dispatchStatOperation } = useCharacterWorkspace()
  const runtime = useOptionalSessionRuntime()
  const progression = normalizeCampaignProgressionSettings(
    runtime?.runtimeConfigSnapshot?.config.progression,
  )
  const progress = getExperienceProgress(character)
  const characterId = character.get("id")

  function setExperience(value: number) {
    const nextExperience = Math.max(0, Math.trunc(value))
    if (dispatchStatOperation({
      type: "character.stat.experience.set",
      characterId,
      value: nextExperience,
    })) return

    updateCharacter(characterId, (current) =>
      current.withStat("experience", nextExperience),
    )
  }

  function adjustExperience(delta: number) {
    setExperience(progress.experience + delta)
  }

  if (progression.mode === "milestone") {
    return (
      <MilestoneProgressionCard
        level={progress.level}
        title={progression.title}
        milestone={progression.milestone}
      />
    )
  }

  if (progression.mode === "custom") {
    return (
      <CustomProgressionCard
        level={progress.level}
        progression={progression}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
              <Award className="h-5 w-5" />
            </span>

            <div>
              <div className="text-sm font-semibold text-textH">Experiência</div>
              <div className="mt-1 text-xs text-textMuted">
                Nível total {progress.level}. A subida de nível automática foi removida temporariamente.
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-semibold text-textH">
            {formatXp(progress.experience)} XP
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">XP atual</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={progress.experience}
              onChange={(event) => setExperience(Number(event.target.value) || 0)}
            />
          </label>

          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button size="sm" variant="secondary" disabled={progress.experience <= 0} onClick={() => adjustExperience(-100)}>
              <Minus className="mr-1 h-3.5 w-3.5" />100
            </Button>
            <Button size="sm" variant="secondary" onClick={() => adjustExperience(100)}>
              <Plus className="mr-1 h-3.5 w-3.5" />100
            </Button>
            <Button size="sm" variant="secondary" onClick={() => adjustExperience(500)}>
              <Plus className="mr-1 h-3.5 w-3.5" />500
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-bg-subtle p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-textH">
              {progress.level >= 20 ? "Nível máximo" : `Progresso para o nível ${progress.level + 1}`}
            </span>

            <span className={progress.canLevelUp ? "font-semibold text-accent" : "text-textMuted"}>
              {progress.level >= 20
                ? `${formatXp(progress.experience)} XP acumulado`
                : progress.canLevelUp
                  ? "XP suficiente para subir de nível"
                  : `${formatXp(progress.experienceRemaining)} XP restantes`}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress.progressPercent}%` }} />
          </div>

          {progress.nextLevelExperience !== undefined ? (
            <div className="mt-2 flex justify-between gap-3 text-[10px] text-textMuted">
              <span>{formatXp(progress.levelStartExperience)} XP</span>
              <span>{formatXp(progress.nextLevelExperience)} XP</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function formatXp(value: number): string {
  return Math.max(0, Math.trunc(value)).toLocaleString("pt-BR")
}


function MilestoneProgressionCard({
  level,
  title,
  milestone,
}: {
  level: number
  title?: string
  milestone?: {
    name: string
    description?: string
    revealed: boolean
    levelUpAvailable: boolean
  }
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
            <Flag className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-textH">
              {title?.trim() || "Marcos"}
            </div>
            <div className="mt-1 text-xs text-textMuted">
              Nível total {level}. A progressão é controlada por marcos da campanha.
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {milestone ? (
          <div className="rounded-xl border border-border bg-bg-subtle p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-textH">
                  {milestone.name}
                </div>
                {milestone.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                    {milestone.description}
                  </p>
                ) : null}
              </div>
              <span
                className={
                  milestone.levelUpAvailable
                    ? "rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-[11px] font-semibold text-accent"
                    : "rounded-full border border-border px-2.5 py-1 text-[11px] text-textMuted"
                }
              >
                {milestone.levelUpAvailable
                  ? "Nível liberado"
                  : "Marco em andamento"}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-textMuted">
            Nenhum marco foi revelado pelo mestre ainda.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CustomProgressionCard({
  level,
  progression,
}: {
  level: number
  progression: CampaignProgressionSettings
}) {
  const tracks = progression.customTracks ?? []
  const pointSystem = progression.pointSystem
  const summary = getCustomProgressionSummary(progression)
  const ready = summary.totalLevelsAvailable > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
              <Gauge className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-textH">
                {progression.title?.trim() || "Progressão"}
              </div>
              <div className="mt-1 text-xs text-textMuted">
                Nível total {level}. O progresso é definido pelas regras desta campanha.
              </div>
            </div>
          </div>

          {ready ? (
            <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-semibold text-accent">
              {summary.totalLevelsAvailable === 1
                ? "1 nível liberado"
                : String(summary.totalLevelsAvailable) + " níveis liberados"}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3">
          {pointSystem?.visibleToPlayers ? (
            <ProgressionPointBank
              pointSystem={pointSystem}
              summary={summary}
            />
          ) : null}

          {tracks.length ? (
            tracks.map((track) => (
              <CustomProgressTrack
                key={track.id}
                track={track}
                pointSystem={pointSystem}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-textMuted">
              Nenhum objetivo de progressão foi revelado ainda.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressionPointBank({
  pointSystem,
  summary,
}: {
  pointSystem: CampaignProgressionPointSystem
  summary: ReturnType<typeof getCustomProgressionSummary>
}) {
  const cost = Math.max(1, summary.pointsPerLevel)
  const towardNext = summary.availablePoints % cost
  const percent =
    summary.levelsAvailableFromPoints > 0
      ? 100
      : Math.max(0, Math.min(100, (towardNext / cost) * 100))

  return (
    <section className="rounded-xl border border-accentBorder bg-accentBg/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-textH">
            {pointSystem.name}
          </div>
          <div className="mt-1 text-xs text-textMuted">
            {formatPointValue(summary.availablePoints, pointSystem.unit)}
            {" disponíveis · "}
            {formatPointValue(summary.pointsPerLevel, pointSystem.unit)}
            {" por nível"}
          </div>
        </div>
        <div className="rounded-lg border border-accentBorder bg-bg px-3 py-1.5 text-xs font-semibold text-textH">
          {formatPointValue(summary.earnedPoints, pointSystem.unit)} ganhos
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: String(percent) + "%" }}
        />
      </div>

      <div className="mt-2 text-[10px] text-textMuted">
        {summary.levelsAvailableFromPoints > 0
          ? String(summary.levelsAvailableFromPoints)
            + " nível"
            + (summary.levelsAvailableFromPoints === 1 ? "" : "is")
            + " disponível"
            + (summary.levelsAvailableFromPoints === 1 ? "" : "eis")
            + " por pontos"
          : formatPointValue(
              Math.max(0, cost - towardNext),
              pointSystem.unit,
            ) + " para o próximo nível"}
      </div>
    </section>
  )
}

function CustomProgressTrack({
  track,
  pointSystem,
}: {
  track: CampaignProgressionTrack
  pointSystem?: CampaignProgressionPointSystem
}) {
  const maximum = Math.max(1, track.maximum)
  const percent = Math.max(0, Math.min(100, (track.current / maximum) * 100))
  const thresholdPercent = Math.max(
    0,
    Math.min(100, (track.levelUpAt / maximum) * 100),
  )
  const unlocked = track.current >= track.levelUpAt
  const directRemaining =
    track.rewardType === "level" && unlocked
      ? Math.max(
          0,
          Math.floor(track.rewardAmount) - Math.floor(track.rewardConsumed),
        )
      : 0

  return (
    <article className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-textH">{track.name}</div>
          {track.description ? (
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-textMuted">
              {track.description}
            </p>
          ) : null}
        </div>

        <div
          className={
            unlocked && track.rewardType !== "none"
              ? "text-xs font-semibold text-accent"
              : "text-xs text-textMuted"
          }
        >
          {formatTrackStatus(track, pointSystem, directRemaining)}
        </div>
      </div>

      <div className="relative mt-3 h-2 rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: String(percent) + "%" }}
        />
        {track.rewardType !== "none" ? (
          <span
            className="absolute top-[-3px] h-3.5 w-0.5 bg-textH"
            style={{ left: String(thresholdPercent) + "%" }}
            title={"Recompensa em " + formatCustomValue(track.levelUpAt, track.unit)}
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-textMuted">
        <span>{formatCustomValue(track.current, track.unit)}</span>
        {track.rewardType !== "none" ? (
          <span>
            {formatCustomValue(track.levelUpAt, track.unit)}
            {" → "}
            {formatTrackReward(track, pointSystem)}
          </span>
        ) : (
          <span>Medidor informativo</span>
        )}
      </div>
    </article>
  )
}

function formatTrackStatus(
  track: CampaignProgressionTrack,
  pointSystem: CampaignProgressionPointSystem | undefined,
  directRemaining: number,
): string {
  if (track.rewardType === "none") {
    return (
      formatCustomValue(track.current, track.unit)
      + " / "
      + formatCustomValue(track.maximum, track.unit)
    )
  }

  if (track.current < track.levelUpAt) {
    return (
      formatCustomValue(track.current, track.unit)
      + " / "
      + formatCustomValue(track.maximum, track.unit)
    )
  }

  if (track.rewardType === "points") {
    return "Meta atingida — " + formatTrackReward(track, pointSystem)
  }

  return directRemaining > 0
    ? String(directRemaining)
      + " nível"
      + (directRemaining === 1 ? "" : "is")
      + " liberado"
      + (directRemaining === 1 ? "" : "s")
    : "Meta concluída"
}

function formatTrackReward(
  track: CampaignProgressionTrack,
  pointSystem?: CampaignProgressionPointSystem,
): string {
  if (track.rewardType === "points") {
    return "+"
      + formatPointValue(
          track.rewardAmount,
          pointSystem?.unit || "PP",
        )
  }
  if (track.rewardType === "level") {
    const amount = Math.max(0, Math.floor(track.rewardAmount))
    return String(amount) + " nível" + (amount === 1 ? "" : "is")
  }
  return "Sem recompensa"
}

function formatPointValue(value: number, unit: string): string {
  const display = Number.isInteger(value)
    ? value.toLocaleString("pt-BR")
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  return (display + " " + unit).trim()
}

function formatCustomValue(value: number, unit: string): string {
  const normalized = Number.isInteger(value)
    ? value.toLocaleString("pt-BR")
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  return unit === "%" ? `${normalized}%` : `${normalized} ${unit}`.trim()
}
