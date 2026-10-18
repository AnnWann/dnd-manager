import { CombatHpEditor } from "../../../packages/game-ui/src/CombatHpEditor"
import { CombatHpModeTabs } from "../../../packages/game-ui/src/CombatHpModeTabs"
import { useMemo, useState } from "react"

import { Modal } from "../../components/ui/Modal"
import { useCharacterContext } from "../../contexts/characterContext"
import { getEffectiveDamageAffinities } from "../../models/characters/characterDamageAffinities"
import {
  DAMAGE_TYPE_OPTIONS,
  damageAffinityLabel,
  resolveDamage,
  type DamageAffinity,
  type DamageType,
} from "../../models/combat/Damage"
import type { InitiativeEntry } from "../../models/initiative/Initiative"
import type { InitiativeDamagePart } from "../session-runtime/initiativeSessionProtocol"

export type InitiativeHpActionMode = "damage" | "heal" | "temporary"

export type InitiativeHpActionPayload =
  | { mode: "damage"; parts: InitiativeDamagePart[] }
  | { mode: "heal" | "temporary"; amount: number }

export type InitiativeHpActionTarget = {
  entry: InitiativeEntry
  affinities: DamageAffinity[]
}

export function InitiativeHpActionDialog({
  targets,
  initialMode,
  onClose,
  onApply,
}: {
  targets: InitiativeHpActionTarget[]
  initialMode: InitiativeHpActionMode
  onClose: () => void
  onApply: (payload: InitiativeHpActionPayload) => void
}) {
  const { visibleCharacters } = useCharacterContext()
  const [mode, setMode] = useState<InitiativeHpActionMode>(initialMode)
  const [amount, setAmount] = useState(1)
  const [parts, setParts] = useState<InitiativeDamagePart[]>([
    { amount: 1, damageType: undefined, magical: false },
  ])

  const targetsWithEffectiveAffinities = useMemo(
    () => targets.map(({ entry, affinities }) => {
      const character = entry.sourceId
        ? visibleCharacters.find((candidate) => candidate.get("id") === entry.sourceId)
        : undefined
      return {
        entry,
        affinities: character ? getEffectiveDamageAffinities(character) : affinities,
      }
    }),
    [targets, visibleCharacters],
  )

  const previews = useMemo(() =>
    targetsWithEffectiveAffinities.map(({ entry, affinities }) => {
      if (mode !== "damage") return { entry, requested: amount, applied: amount, rules: [] as string[] }
      const resolved = parts.map((part) => resolveDamage(part.amount, part.damageType, affinities, { magical: part.magical }))
      return {
        entry,
        requested: resolved.reduce((total, result) => total + result.requested, 0),
        applied: resolved.reduce((total, result) => total + result.applied, 0),
        rules: Array.from(new Set(resolved.flatMap((result) => result.affinity ? [damageAffinityLabel(result.affinity)] : []))),
      }
    }),
  [amount, mode, parts, targetsWithEffectiveAffinities])

  const valid = mode === "damage"
    ? parts.length > 0 && parts.every((part) => Number.isInteger(part.amount) && part.amount > 0)
    : Number.isInteger(amount) && amount > 0

  function submit() {
    if (!valid) return
    if (mode === "damage") {
      onApply({ mode, parts })
      return
    }
    onApply({ mode, amount })
  }

  return (
    <Modal
      title={mode === "damage" ? "Aplicar dano" : mode === "heal" ? "Aplicar cura" : "Adicionar PV temporários"}
      onClose={onClose}
      className="max-w-3xl"
    >
      <div className="grid gap-4">
        <CombatHpModeTabs mode={mode} count={targets.length} onChange={setMode} />

        <CombatHpEditor
          mode={mode}
          amount={amount}
          parts={parts}
          damageTypes={DAMAGE_TYPE_OPTIONS}
          previews={previews.map(({ entry, requested, applied, rules }) => ({
            id: entry.id, name: entry.name, requested, applied, rules,
          }))}
          valid={valid}
          onAmountChange={setAmount}
          onPartsChange={next => setParts(next.map(part => ({
            ...part, damageType: part.damageType as DamageType | undefined,
          })))}
          onSubmit={submit}
          onCancel={onClose}
        />
      </div>
    </Modal>
  )
}
