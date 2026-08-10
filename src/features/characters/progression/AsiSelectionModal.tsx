import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Select } from "../../../components/ui/Select"
import type { Ability } from "../../../models/abilities/Ability"
import type {
  CharacterAsi,
  CharacterAsiKind,
} from "../../../models/characters/CharacterAsi"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { ClassName } from "../../../models/sheet/Class"
import { AbilityDialog } from "../abilities/abilityDialog"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "Força" },
  { value: "dex", label: "Destreza" },
  { value: "con", label: "Constituição" },
  { value: "int", label: "Inteligência" },
  { value: "wis", label: "Sabedoria" },
  { value: "cha", label: "Carisma" },
]

type ScoreMode = "plus-two" | "split"

type Props = {
  open: boolean
  value: CharacterAsi | null
  className: ClassName
  classLevel: number
  onChange: (value: CharacterAsi) => void
  onClose: () => void
}

export function AsiSelectionModal({
  open,
  value,
  className,
  classLevel,
  onChange,
  onClose,
}: Props) {
  const [kind, setKind] = useState<CharacterAsiKind>("ability-score")
  const [scoreMode, setScoreMode] = useState<ScoreMode>("plus-two")
  const [primary, setPrimary] = useState<Attribute>("str")
  const [secondary, setSecondary] = useState<Attribute>("dex")
  const [ability, setAbility] = useState<Ability | null>(null)
  const [abilityEditorOpen, setAbilityEditorOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!value) {
      setKind("ability-score")
      setScoreMode("plus-two")
      setPrimary("str")
      setSecondary("dex")
      setAbility(null)
      return
    }

    setKind(value.kind)
    setAbility(value.ability ?? null)
    const increases = Object.entries(value.increases).filter(
      ([, amount]) => Number(amount) > 0,
    ) as Array<[Attribute, number]>
    setPrimary(increases[0]?.[0] ?? "str")
    setSecondary(increases[1]?.[0] ?? "dex")
    setScoreMode(increases.some(([, amount]) => amount === 2) ? "plus-two" : "split")
  }, [open, value])

  if (!open) return null

  const requiresFeat = kind === "feat" || kind === "half-feat"
  const invalidSplit =
    kind === "ability-score" && scoreMode === "split" && primary === secondary

  function confirm() {
    if (requiresFeat && !ability) return
    if (invalidSplit) return

    const increases = getIncreases(kind, scoreMode, primary, secondary)
    onChange({
      id: value?.id ?? crypto.randomUUID(),
      className,
      classLevel,
      kind,
      ability: requiresFeat && ability
        ? {
            ...ability,
            category: "feat",
            source: "asi",
          }
        : undefined,
      increases,
      acquisition: value?.acquisition,
    })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <section className="w-full max-w-2xl rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold text-textH">Aumento de atributo / talento</h2>
            <div className="mt-1 text-xs text-textMuted">
              Nível {classLevel} da classe
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
        </header>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-xs text-text">
            Escolha
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value as CharacterAsiKind)}
            >
              <option value="ability-score">Aumento de atributo</option>
              <option value="feat">Talento</option>
              <option value="half-feat">Meio talento (+1 atributo)</option>
            </Select>
          </label>

          {kind === "ability-score" ? (
            <div className="grid gap-3 rounded-xl border border-border bg-bg p-3">
              <label className="grid gap-1.5 text-xs text-text">
                Distribuição
                <Select
                  value={scoreMode}
                  onChange={(event) => setScoreMode(event.target.value as ScoreMode)}
                >
                  <option value="plus-two">+2 em um atributo</option>
                  <option value="split">+1 em dois atributos</option>
                </Select>
              </label>

              <div className={scoreMode === "split" ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
                <AttributeSelect label={scoreMode === "split" ? "Primeiro +1" : "Atributo +2"} value={primary} onChange={setPrimary} />
                {scoreMode === "split" ? (
                  <AttributeSelect label="Segundo +1" value={secondary} onChange={setSecondary} />
                ) : null}
              </div>

              {invalidSplit ? (
                <div className="text-xs text-danger">Escolha dois atributos diferentes.</div>
              ) : null}
            </div>
          ) : null}

          {kind === "half-feat" ? (
            <div className="rounded-xl border border-border bg-bg p-3">
              <AttributeSelect label="Atributo que recebe +1" value={primary} onChange={setPrimary} />
            </div>
          ) : null}

          {requiresFeat ? (
            <div className="rounded-xl border border-border bg-bg p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-textH">
                    {kind === "half-feat" ? "Meio talento" : "Talento"}
                  </div>
                  <div className="mt-1 text-xs text-textMuted">
                    {ability?.name ?? "Nenhum talento configurado"}
                  </div>
                </div>
                <Button size="sm" onClick={() => setAbilityEditorOpen(true)}>
                  {ability ? "Editar" : "Configurar"}
                </Button>
              </div>
              {ability?.description?.trim() ? (
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-textMuted">
                  {ability.description}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={(requiresFeat && !ability) || invalidSplit} onClick={confirm}>
            Salvar ASI
          </Button>
        </footer>

        <AbilityDialog
          open={abilityEditorOpen}
          ability={ability}
          title={ability ? "Editar talento" : "Adicionar talento"}
          fixedCategory="feat"
          onClose={() => setAbilityEditorOpen(false)}
          onSave={(next) => {
            setAbility({ ...next, category: "feat", source: "asi" })
            setAbilityEditorOpen(false)
          }}
        />
      </section>
    </div>,
    document.body,
  )
}

function AttributeSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: Attribute
  onChange: (value: Attribute) => void
}) {
  return (
    <label className="grid gap-1.5 text-xs text-text">
      {label}
      <Select value={value} onChange={(event) => onChange(event.target.value as Attribute)}>
        {ATTRIBUTES.map((attribute) => (
          <option key={attribute.value} value={attribute.value}>
            {attribute.label}
          </option>
        ))}
      </Select>
    </label>
  )
}

function getIncreases(
  kind: CharacterAsiKind,
  scoreMode: ScoreMode,
  primary: Attribute,
  secondary: Attribute,
): Partial<Record<Attribute, number>> {
  if (kind === "feat") return {}
  if (kind === "half-feat") return { [primary]: 1 }
  if (scoreMode === "plus-two") return { [primary]: 2 }
  return { [primary]: 1, [secondary]: 1 }
}
