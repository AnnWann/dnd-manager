import { useState } from "react"
import { Award, GraduationCap, Minus, Plus } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getExperienceProgress } from "../../../models/characters/characterExperience"
import { LevelUpWizardV2 } from "./levelUpWizardV2"

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
  const progress = getExperienceProgress(character)
  const [levelUpOpen, setLevelUpOpen] = useState(false)

  function setExperience(value: number) {
    updateCharacter(character.get("id"), (current) =>
      current.withStat("experience", Math.max(0, Math.trunc(value))),
    )
  }

  function adjustExperience(delta: number) {
    setExperience(progress.experience + delta)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
                <Award className="h-5 w-5" />
              </span>

              <div>
                <div className="text-sm font-semibold text-textH">
                  Experiência
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  Nível total {progress.level}. O assistente valida multiclasse e aplica cada escolha antes de alterar a ficha.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-semibold text-textH">
                {formatXp(progress.experience)} XP
              </div>
              <Button
                size="sm"
                variant={progress.canLevelUp ? "primary" : "secondary"}
                disabled={progress.level >= 20}
                title={
                  progress.canLevelUp
                    ? "XP suficiente para subir de nível"
                    : "Também pode ser usado em campanhas por marco, com autorização do mestre"
                }
                onClick={() => setLevelUpOpen(true)}
              >
                <GraduationCap className="h-4 w-4" />
                Subir de nível
              </Button>
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
                onChange={(event) =>
                  setExperience(Number(event.target.value) || 0)
                }
              />
            </label>

            <div className="grid grid-cols-3 gap-2 sm:flex">
              <Button
                size="sm"
                variant="secondary"
                disabled={progress.experience <= 0}
                onClick={() => adjustExperience(-100)}
              >
                <Minus className="mr-1 h-3.5 w-3.5" />
                100
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => adjustExperience(100)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                100
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => adjustExperience(500)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                500
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-bg-subtle p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-textH">
                {progress.level >= 20
                  ? "Nível máximo"
                  : `Progresso para o nível ${progress.level + 1}`}
              </span>

              <span
                className={
                  progress.canLevelUp
                    ? "font-semibold text-accent"
                    : "text-textMuted"
                }
              >
                {progress.level >= 20
                  ? `${formatXp(progress.experience)} XP acumulado`
                  : progress.canLevelUp
                    ? "XP suficiente para subir de nível"
                    : `${formatXp(progress.experienceRemaining)} XP restantes`}
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${progress.progressPercent}%` }}
              />
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

      <LevelUpWizardV2
        open={levelUpOpen}
        character={character}
        onApply={(nextCharacter) => {
          updateCharacter(character.get("id"), () => nextCharacter)
          setLevelUpOpen(false)
        }}
        onClose={() => setLevelUpOpen(false)}
      />
    </>
  )
}

function formatXp(value: number): string {
  return Math.max(0, Math.trunc(value)).toLocaleString("pt-BR")
}
