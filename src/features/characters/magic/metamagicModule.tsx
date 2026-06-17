import { useMemo, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import { MetamagicSelector } from "../../magic/metamagicSelector/metamagicSelector"
import { getMetamagicLimit } from "../../../rules/MetamagicsRules"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function MetamagicModule({ character, updateCharacter }: Props) {
  const { metamagics, getMetamagicsByIds } = useMagicContext()
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  const knownMetamagicIds =
    character.get("magic")?.metamagic?.metamagics ?? []

  const knownMetamagics = useMemo(
    () => getMetamagicsByIds(knownMetamagicIds),
    [getMetamagicsByIds, knownMetamagicIds],
  )

  const sorcererLevel = character.getClassLevel("sorcerer")
  const maxMetamagics = getMetamagicLimit(sorcererLevel)
  const hasReachedLimit = knownMetamagicIds.length >= maxMetamagics

  function addSelectedMetamagic(id: MetamagicId) {
    if (hasReachedLimit) return

    updateCharacter(character.get("id"), (c) => c.addMetamagic(id))
    setIsSelectorOpen(false)
  }

  function removeSelectedMetamagic(id: MetamagicId) {
    updateCharacter(character.get("id"), (c) => c.removeMetamagic(id))
  }

  const sorceryPoints = character.getSorceryPoints()

  function spendSorceryPoint() {
    updateCharacter(character.get("id"), (c) => c.spendSorceryPoint())
  }

  function restoreSorceryPoint() {
    updateCharacter(character.get("id"), (c) => c.restoreSorceryPoint())
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-textH">
              Metamagia
            </div>

            <div className="mt-1 text-xs text-text">
              {knownMetamagicIds.length}/{maxMetamagics} metamagias conhecidas.
            </div>
          </div>

          <Button
            size="sm"
            variant="primary"
            disabled={hasReachedLimit}
            onClick={() => setIsSelectorOpen(true)}
          >
            Adicionar
          </Button>
        </div>
      </CardHeader>
      
      <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div>
          <div className="text-sm font-medium text-textH">
            Pontos de feitiçaria
          </div>

          <div className="text-xs text-text">
            {sorceryPoints.current}/{sorceryPoints.max} disponíveis
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={sorceryPoints.current <= 0}
            onClick={spendSorceryPoint}
          >
            Gastar
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={sorceryPoints.current >= sorceryPoints.max}
            onClick={restoreSorceryPoint}
          >
            Restaurar
          </Button>
        </div>
      </div>

      <CardContent>
        {knownMetamagics.length === 0 ? (
          <p className="text-xs text-text">
            Nenhuma metamagia escolhida.
          </p>
        ) : (
          <div className="grid gap-3">
            {knownMetamagics.map((metamagic) => (
              <div
                key={metamagic.id}
                className="rounded-xl border border-accentBorder bg-bg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-textH">
                      {metamagic.name}
                    </div>

                    <div className="mt-1 text-xs text-text">
                      Custo: {formatCost(metamagic.sorceryPointCost)} •{" "}
                      {formatTiming(metamagic.timing)}
                    </div>

                    <div className="mt-2 grid gap-1 text-xs leading-5 text-text">
                      {metamagic.desc.map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSelectedMetamagic(metamagic.id)}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <MetamagicSelector
        open={isSelectorOpen}
        metamagics={metamagics}
        knownMetamagicIds={knownMetamagicIds}
        onAdd={addSelectedMetamagic}
        onClose={() => setIsSelectorOpen(false)}
      />
    </Card>
  )
}

function formatCost(cost: number | "spell-level") {
  if (cost === "spell-level") return "nível da magia"
  return `${cost} ponto${cost === 1 ? "" : "s"}`
}

function formatTiming(timing: string) {
  switch (timing) {
    case "on-cast":
      return "ao conjurar"
    case "on-damage-roll":
      return "ao rolar dano"
    case "on-miss":
      return "ao errar"
    default:
      return timing
  }
}