import { useEffect, useMemo, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getSorcererLevel,
  getSorceryPointPool,
  isSorceryPointPoolSynchronized,
  restoreSorceryPointDerived,
  spendSorceryPointDerived,
  synchronizeSorceryPointPool,
} from "../../../models/characters/characterSorceryPoints"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import { getMetamagicLimit } from "../../../rules/MetamagicsRules"
import { MetamagicSelector } from "../../magic/metamagicSelector/metamagicSelector"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"

type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (c: CharacterTemplate) => CharacterTemplate) => void
}

export function MetamagicModule({ character, updateCharacter }: Props) {
  const runtime = useOptionalSessionRuntime()
  const { metamagics, getMetamagicsByIds } = useMagicContext()
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const characterId = character.get("id")
  const knownMetamagicIds = character.get("magic")?.metamagic?.metamagics ?? []
  const knownMetamagics = useMemo(() => getMetamagicsByIds(knownMetamagicIds), [getMetamagicsByIds, knownMetamagicIds])
  const sorcererLevel = getSorcererLevel(character)
  const maxMetamagics = getMetamagicLimit(sorcererLevel)
  const hasReachedLimit = knownMetamagicIds.length >= maxMetamagics
  const sorceryPoints = getSorceryPointPool(character)

  useEffect(() => {
    if (isSorceryPointPoolSynchronized(character)) return
    if (runtime) return
    updateCharacter(characterId, (current) => synchronizeSorceryPointPool(current))
  }, [character, characterId, runtime, updateCharacter])

  function addSelectedMetamagic(id: MetamagicId) {
    if (hasReachedLimit) return
    if (runtime) runtime.dispatchMagicOperation({ type: "character.metamagic.add", characterId, metamagicId: id })
    else updateCharacter(characterId, (current) => synchronizeSorceryPointPool(current.addMetamagic(id)))
    setIsSelectorOpen(false)
  }

  function removeSelectedMetamagic(id: MetamagicId) {
    if (runtime) { runtime.dispatchMagicOperation({ type: "character.metamagic.remove", characterId, metamagicId: id }); return }
    updateCharacter(characterId, (current) => synchronizeSorceryPointPool(current.removeMetamagic(id)))
  }
  function spendSorceryPoint() {
    if (runtime) { runtime.dispatchMagicOperation({ type: "character.sorceryPoint.spend", characterId }); return }
    updateCharacter(characterId, spendSorceryPointDerived)
  }
  function restoreSorceryPoint() {
    if (runtime) { runtime.dispatchMagicOperation({ type: "character.sorceryPoint.restore", characterId }); return }
    updateCharacter(characterId, restoreSorceryPointDerived)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-textH">Metamagia</div>
            <div className="mt-1 text-xs text-text">{knownMetamagicIds.length}/{maxMetamagics} metamagias conhecidas.</div>
          </div>
          <Button size="sm" variant="primary" disabled={hasReachedLimit || maxMetamagics <= 0} onClick={() => setIsSelectorOpen(true)}>Adicionar</Button>
        </div>
      </CardHeader>

      <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div>
          <div className="text-sm font-medium text-textH">Pontos de feitiçaria</div>
          <div className="text-xs text-text">{sorceryPoints.current}/{sorceryPoints.max} disponíveis</div>
          <div className="mt-1 text-[10px] text-textMuted">Máximo calculado pelo nível de feiticeiro ({sorcererLevel}).</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={sorceryPoints.current <= 0} onClick={spendSorceryPoint}>Gastar</Button>
          <Button size="sm" variant="secondary" disabled={sorceryPoints.current >= sorceryPoints.max} onClick={restoreSorceryPoint}>Restaurar</Button>
        </div>
      </div>

      <CardContent>
        {knownMetamagics.length === 0 ? (
          <p className="text-xs text-text">{maxMetamagics > 0 ? "Nenhuma metamagia escolhida." : "Metamagia é liberada no 3º nível de feiticeiro."}</p>
        ) : (
          <div className="grid gap-3">
            {knownMetamagics.map((metamagic) => (
              <div key={metamagic.id} className="rounded-xl border border-accentBorder bg-bg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-textH">{metamagic.name}</div>
                    <div className="mt-1 text-xs text-text">Custo: {formatCost(metamagic.sorceryPointCost)} • {formatTiming(metamagic.timing)}</div>
                    <div className="mt-2 grid gap-1 text-xs leading-5 text-text">{metamagic.desc.map((line, index) => <p key={index}>{line}</p>)}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeSelectedMetamagic(metamagic.id)}>Remover</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <MetamagicSelector open={isSelectorOpen} metamagics={metamagics} knownMetamagicIds={knownMetamagicIds} onAdd={addSelectedMetamagic} onClose={() => setIsSelectorOpen(false)} />
    </Card>
  )
}

function formatCost(cost: number | "spell-level") {
  if (cost === "spell-level") return "nível da magia"
  return `${cost} ponto${cost === 1 ? "" : "s"}`
}
function formatTiming(timing: string) {
  switch (timing) {
    case "on-cast": return "ao conjurar"
    case "on-damage-roll": return "ao rolar dano"
    case "on-miss": return "ao errar"
    default: return timing
  }
}
