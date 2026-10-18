import type { CharacterExperienceProgress } from "../../game-core/src/experience"

type Props = {
  progress: CharacterExperienceProgress
  formatXp?: (value: number) => string
}

/** Presentation-only experience meter. No character, session, or router context required. */
export function ExperienceProgress({
  progress,
  formatXp = (value) => Math.max(0, Math.trunc(value)).toLocaleString("pt-BR"),
}: Props) {
  return (
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
  )
}
