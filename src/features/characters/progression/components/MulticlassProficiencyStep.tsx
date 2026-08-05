import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { SKILL_LABELS } from "../../../../data/characterCreation/phbPresets"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import { getClassProficiencyRule } from "../../../../models/leveling/ClassProficiencyRules"
import { getClassNamePt } from "../../../../models/leveling/ClassLocalization"
import type { ClassName } from "../../../../models/sheet/Class"
import type { Skill } from "../../../../models/sheet/Skills"

type Props = {
  character: CharacterTemplate
  classNames: ClassName[]
  selectedSkills: Partial<Record<ClassName, Skill[]>>
  selectedTools: Partial<Record<ClassName, string>>
  validationMessage: string
  onToggleSkill: (className: ClassName, skill: Skill) => void
  onToolChange: (className: ClassName, value: string) => void
  onBack: () => void
  onConfirm: () => void
}

export function MulticlassProficiencyStep({
  character,
  classNames,
  selectedSkills,
  selectedTools,
  validationMessage,
  onToggleSkill,
  onToolChange,
  onBack,
  onConfirm,
}: Props) {
  const blockedSkills = new Set<Skill>(
    Object.entries(character.get("sheet").skills ?? {})
      .filter(([, level]) => level !== "none")
      .map(([skill]) => skill as Skill),
  )

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-textH">
          Proficiências da nova classe
        </h1>
        <p className="mt-1 text-sm leading-6 text-textMuted">
          Uma multiclasse não concede salvaguardas nem todo o treinamento da classe inicial. Revise as concessões abaixo e complete somente as escolhas previstas pela regra de multiclasse.
        </p>
      </header>

      {classNames.map((className) => {
        const rule = getClassProficiencyRule(className)
        const skillRule = rule.multiclassSkills
        const currentSkills = selectedSkills[className] ?? []

        return (
          <article
            key={className}
            className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4"
          >
            <div>
              <h2 className="font-semibold text-textH">
                {getClassNamePt(className)}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {rule.multiclass.length ? (
                  rule.multiclass.map((proficiency) => (
                    <Badge key={proficiency.id}>{proficiency.name}</Badge>
                  ))
                ) : (
                  <span className="text-xs text-textMuted">
                    Esta classe não concede proficiências fixas ao entrar por multiclasse.
                  </span>
                )}
              </div>
            </div>

            {skillRule ? (
              <section>
                <div className="text-xs font-semibold text-textH">
                  Escolha {skillRule.count}{" "}
                  {skillRule.count === 1 ? "perícia" : "perícias"} ({currentSkills.length}/{skillRule.count})
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {Object.entries(SKILL_LABELS)
                    .filter(([rawSkill]) =>
                      skillRule.options === "any"
                        ? true
                        : skillRule.options.includes(rawSkill as Skill),
                    )
                    .map(([rawSkill, label]) => {
                      const skill = rawSkill as Skill
                      const selected = currentSkills.includes(skill)
                      const blocked = blockedSkills.has(skill)
                      return (
                        <button
                          key={skill}
                          type="button"
                          disabled={
                            blocked ||
                            (!selected && currentSkills.length >= skillRule.count)
                          }
                          onClick={() => onToggleSkill(className, skill)}
                          className={
                            selected
                              ? "rounded-lg border border-accentBorder bg-accentBg p-2 text-left text-xs text-textH"
                              : "rounded-lg border border-border bg-bg p-2 text-left text-xs text-textMuted disabled:opacity-50"
                          }
                        >
                          <span className="block font-medium">{label}</span>
                          {blocked ? (
                            <span className="mt-1 block text-[10px]">
                              Já proficiente
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                </div>
              </section>
            ) : null}

            {rule.multiclassChoiceLabel ? (
              <label className="grid gap-1.5 text-xs text-text">
                {rule.multiclassChoiceLabel}
                <Input
                  value={selectedTools[className] ?? ""}
                  placeholder="Digite a escolha"
                  onChange={(event) =>
                    onToolChange(className, event.target.value)
                  }
                />
              </label>
            ) : null}
          </article>
        )
      })}

      {validationMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
          {validationMessage}
        </div>
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack}>
          Voltar à progressão
        </Button>
        <Button onClick={onConfirm}>
          Confirmar proficiências e concluir
        </Button>
      </footer>
    </section>
  )
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {children}
    </span>
  )
}
