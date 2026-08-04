import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { DieSides } from "../../../models/dice/Die"
import {
  CharacterClassBuilder,
  type CharacterClassInterface,
  type ClassLevel,
  type ClassName,
} from "../../../models/sheet/Class"
import { PHB_CLASS_PRESETS } from "../creation/phbPresets"

type Props = {
  character: CharacterTemplate
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

export function CharacterLevelUpWizard({
  character,
  onCancel,
  onComplete,
}: Props) {
  const classes = character.get("sheet").classes ?? []
  const totalLevel = classes.reduce((sum, entry) => sum + entry.level, 0)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [mode, setMode] = useState<"existing" | "multiclass">(
    classes.length ? "existing" : "multiclass",
  )
  const [className, setClassName] = useState<ClassName>(
    classes[0]?.className ?? "fighter",
  )
  const [hpMode, setHpMode] = useState<"average" | "manual">("average")

  const selectedPreset = useMemo(
    () =>
      PHB_CLASS_PRESETS.find((preset) => preset.id === className) ??
      PHB_CLASS_PRESETS[0],
    [className],
  )
  const existingClass = classes.find(
    (entry) => entry.className === className,
  )
  const nextClassLevel =
    mode === "existing" ? (existingClass?.level ?? 0) + 1 : 1
  const conModifier = character.getAttributeModifier("con")
  const averageHp = Math.max(
    1,
    Math.floor(Number(selectedPreset.hitDie.slice(1)) / 2) + 1 + conModifier,
  )
  const [manualHp, setManualHp] = useState(String(averageHp))
  const hpGain =
    hpMode === "average"
      ? averageHp
      : Math.max(1, Math.trunc(Number(manualHp) || 1))
  const classAlreadyPresent = Boolean(existingClass)
  const invalidMulticlass = mode === "multiclass" && classAlreadyPresent
  const maximumReached = totalLevel >= 20 || nextClassLevel > 20
  const canContinue = !invalidMulticlass && !maximumReached
  const pendingReviews = getPendingReviews(
    className,
    nextClassLevel,
    mode === "multiclass",
  )

  function complete() {
    const updated = applyLevelUp(
      character,
      className,
      mode,
      hpGain,
      selectedPreset.hitDie,
      pendingReviews,
    )
    onComplete(updated)
  }

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-textH">Subir de nível</h1>
          <p className="mt-1 text-sm text-textMuted">
            {character.get("name")} · nível total atual {totalLevel} · etapa {step} de 3
          </p>
        </div>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </header>

      {maximumReached ? (
        <div className="rounded-xl border border-warning bg-warningBg p-4 text-sm text-textH">
          O personagem já atingiu o limite de nível aplicável.
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={
                mode === "existing"
                  ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                  : "rounded-xl border border-border bg-bg-subtle p-4 text-left hover:bg-accentBg"
              }
              disabled={!classes.length}
              onClick={() => {
                setMode("existing")
                setClassName(classes[0]?.className ?? "fighter")
              }}
            >
              <span className="block font-semibold text-textH">
                Avançar classe existente
              </span>
              <span className="mt-1 block text-xs leading-5 text-textMuted">
                Aumenta em um o nível de uma classe que o personagem já possui.
              </span>
            </button>

            <button
              type="button"
              className={
                mode === "multiclass"
                  ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                  : "rounded-xl border border-border bg-bg-subtle p-4 text-left hover:bg-accentBg"
              }
              onClick={() => setMode("multiclass")}
            >
              <span className="block font-semibold text-textH">Multiclasse</span>
              <span className="mt-1 block text-xs leading-5 text-textMuted">
                Adiciona o primeiro nível de uma classe que ainda não está na ficha.
              </span>
            </button>
          </div>

          <label className="grid gap-1.5 text-xs text-text">
            Classe
            <select
              className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
              value={className}
              onChange={(event) =>
                setClassName(event.target.value as ClassName)
              }
            >
              {PHB_CLASS_PRESETS.filter((preset) =>
                mode === "existing"
                  ? classes.some((entry) => entry.className === preset.id)
                  : !classes.some((entry) => entry.className === preset.id),
              ).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-border bg-bg-subtle p-4 text-sm text-text">
            <div>
              <span className="text-textMuted">Resultado:</span>{" "}
              {selectedPreset.name} nível {nextClassLevel}
            </div>
            <div className="mt-1">
              <span className="text-textMuted">Nível total:</span>{" "}
              {totalLevel + 1}
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4">
          <div className="rounded-xl border border-border bg-bg-subtle p-4">
            <h2 className="font-semibold text-textH">Pontos de vida</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Dado de vida {selectedPreset.hitDie}; modificador de Constituição {formatSigned(conModifier)}.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={
                  hpMode === "average"
                    ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                    : "rounded-xl border border-border bg-bg p-4 text-left"
                }
                onClick={() => setHpMode("average")}
              >
                <span className="font-semibold text-textH">Média fixa</span>
                <span className="mt-1 block text-xs text-textMuted">
                  Ganho de {averageHp} PV.
                </span>
              </button>

              <button
                type="button"
                className={
                  hpMode === "manual"
                    ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                    : "rounded-xl border border-border bg-bg p-4 text-left"
                }
                onClick={() => setHpMode("manual")}
              >
                <span className="font-semibold text-textH">Rolagem ou valor manual</span>
                <span className="mt-1 block text-xs text-textMuted">
                  Informe o ganho final já incluindo Constituição.
                </span>
              </button>
            </div>

            {hpMode === "manual" ? (
              <label className="mt-4 grid max-w-xs gap-1.5 text-xs text-text">
                PV ganhos
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={manualHp}
                  onChange={(event) => setManualHp(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-bg-subtle p-4">
            <h2 className="font-semibold text-textH">Revisões deste nível</h2>
            {pendingReviews.length ? (
              <ul className="mt-3 grid gap-2 text-sm text-text">
                {pendingReviews.map((review) => (
                  <li key={review} className="rounded-lg border border-border bg-bg p-3">
                    {review}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-textMuted">
                Nenhuma revisão especial foi detectada para este nível.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-4 text-sm text-text">
          <div>
            <span className="text-textMuted">Classe:</span>{" "}
            {selectedPreset.name} {nextClassLevel}
          </div>
          <div>
            <span className="text-textMuted">Nível total:</span>{" "}
            {totalLevel} → {totalLevel + 1}
          </div>
          <div>
            <span className="text-textMuted">PV:</span> +{hpGain}
          </div>
          <div>
            <span className="text-textMuted">Dado de vida:</span> +1 {selectedPreset.hitDie}
          </div>
          {pendingReviews.length ? (
            <div className="rounded-lg border border-warning bg-warningBg p-3 text-xs leading-5 text-textH">
              As revisões listadas serão registradas nas notas da ficha. Elas não são aplicadas automaticamente porque ainda não existe um catálogo relacional completo de características de classe e talentos.
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          onClick={() => {
            if (step === 1) onCancel()
            else setStep((step - 1) as 1 | 2)
          }}
        >
          {step === 1 ? "Cancelar" : "Voltar"}
        </Button>

        {step < 3 ? (
          <Button
            disabled={!canContinue}
            onClick={() => setStep((step + 1) as 2 | 3)}
          >
            Continuar
          </Button>
        ) : (
          <Button disabled={!canContinue} onClick={complete}>
            Aplicar nível
          </Button>
        )}
      </footer>
    </section>
  )
}

function applyLevelUp(
  character: CharacterTemplate,
  className: ClassName,
  mode: "existing" | "multiclass",
  hpGain: number,
  hitDie: DieSides,
  pendingReviews: string[],
): CharacterTemplate {
  const sheet = character.get("sheet")
  const classes = [...(sheet.classes ?? [])]

  if (mode === "existing") {
    const index = classes.findIndex((entry) => entry.className === className)
    if (index < 0) throw new Error("Classe existente não encontrada.")

    classes[index] = {
      ...classes[index],
      level: Math.min(20, classes[index].level + 1) as ClassLevel,
    }
  } else {
    classes.push(createClass(className))
  }

  const currentHp = sheet.HP
  const currentHitDice = currentHp.hitDice ?? {}
  const currentDie = currentHitDice[hitDie] ?? {
    max: { quantity: 0, sides: hitDie },
    current: { quantity: 0, sides: hitDie },
  }

  const nextNotes = pendingReviews.length
    ? [
        ...character.get("notes"),
        `Subida de nível — ${classDisplayName(className)}: ${pendingReviews.join(" | ")}`,
      ]
    : character.get("notes")

  return character
    .withPatch({
      sheet: {
        ...sheet,
        classes,
        HP: {
          ...currentHp,
          max: currentHp.max + hpGain,
          current: currentHp.current + hpGain,
          hitDice: {
            ...currentHitDice,
            [hitDie]: {
              max: {
                quantity: currentDie.max.quantity + 1,
                sides: hitDie,
              },
              current: {
                quantity: currentDie.current.quantity + 1,
                sides: hitDie,
              },
            },
          },
        },
      },
      notes: nextNotes,
    })
    .syncMagicWithClasses()
}

function createClass(className: ClassName): CharacterClassInterface {
  const builder = new CharacterClassBuilder()

  switch (className) {
    case "artificer":
      return builder.artificer()
    case "barbarian":
      return builder.barbarian()
    case "bard":
      return builder.bard()
    case "cleric":
      return builder.cleric()
    case "druid":
      return builder.druid()
    case "fighter":
      return builder.fighter()
    case "monk":
      return builder.monk()
    case "paladin":
      return builder.paladin()
    case "ranger":
      return builder.ranger()
    case "rogue":
      return builder.rogue()
    case "sorcerer":
      return builder.sorcerer()
    case "warlock":
      return builder.warlock()
    case "wizard":
      return builder.wizard()
  }
}

function getPendingReviews(
  className: ClassName,
  classLevel: number,
  multiclass: boolean,
): string[] {
  const reviews = ["Revisar características concedidas pela classe neste nível."]

  if (multiclass) {
    reviews.push(
      "Confirmar pré-requisitos de multiclasse e proficiências concedidas pelo primeiro nível.",
    )
  }

  if ([4, 8, 12, 16, 19].includes(classLevel)) {
    reviews.push("Escolher aumento no valor de habilidade ou talento.")
  }

  if (
    (className === "cleric" && classLevel === 1) ||
    (className === "druid" && classLevel === 2) ||
    ([
      "bard",
      "fighter",
      "monk",
      "paladin",
      "ranger",
      "rogue",
      "sorcerer",
      "wizard",
      "artificer",
    ].includes(className) &&
      classLevel === 3) ||
    (className === "warlock" && classLevel === 1) ||
    (className === "barbarian" && classLevel === 3)
  ) {
    reviews.push("Escolher ou revisar a subclasse.")
  }

  if (
    [
      "artificer",
      "bard",
      "cleric",
      "druid",
      "paladin",
      "ranger",
      "sorcerer",
      "warlock",
      "wizard",
    ].includes(className)
  ) {
    reviews.push("Revisar magias conhecidas, preparadas e espaços de magia.")
  }

  return reviews
}

function classDisplayName(className: ClassName): string {
  return PHB_CLASS_PRESETS.find((preset) => preset.id === className)?.name ?? className
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}
