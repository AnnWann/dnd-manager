import { Button } from "../../../components/ui/Button"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"

type Props<T extends Equipment> = {
  equipment: T
  onUpdate: (updater: (equipment: T) => T) => void
}

export function EquipmentFeaturesList <T extends Equipment>({ equipment, onUpdate }: Props<T>) {
  const abilities = equipment.abilities ?? []
  const spells = equipment.spells ?? []

  if (!abilities.length && !spells.length) return null

  function updateAbilityCharge(abilityId: string, delta: number) {
    onUpdate((current) => ({
      ...current,
      abilities: (current.abilities ?? []).map((ability) => {
        if (ability.id !== abilityId || !ability.usage) return ability
        if (ability.usage.reset === "spellSlot") return ability

        return {
          ...ability,
          usage: {
            ...ability.usage,
            used: Math.max(
              0,
              Math.min(ability.usage.max, ability.usage.used + delta),
            ),
          },
        }
      }),
    }))
  }

  function updateSpellCharge(spellIndex: string, delta: number) {
    onUpdate((current) => ({
      ...current,
      spells: (current.spells ?? []).map((spell) => {
        if (spell.index !== spellIndex) return spell
        if (spell.usage.reset === "spellSlot") return spell

        return {
          ...spell,
          usage: {
            ...spell.usage,
            used: Math.max(
              0,
              Math.min(spell.usage.max, spell.usage.used + delta),
            ),
          },
        }
      }),
    }))
  }

  return (
    <div className="grid gap-3">
      {abilities.length ? (
        <div className="rounded-md border border-border p-3">
          <div className="text-xs font-medium text-textH">Habilidades</div>

          <div className="mt-2 grid gap-2">
            {abilities.map((ability) => {
              const usage = ability.usage
              const canConsume = usage && usage.reset !== "spellSlot"
              const canRestore =
                usage &&
                usage.reset !== "spellSlot" &&
                usage.reset !== "limited"

              return (
                <div key={ability.id} className="rounded-md border border-border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-textH">
                        {ability.name || "Habilidade sem nome"}
                      </div>

                      {usage ? (
                        <div className="mt-1 text-xs text-text">
                          {usage.reset === "spellSlot"
                            ? "Usa slot de magia"
                            : `${usage.max - usage.used}/${usage.max} cargas`}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      {canConsume ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={usage.used >= usage.max}
                          onClick={() => updateAbilityCharge(ability.id, 1)}
                        >
                          Consumir
                        </Button>
                      ) : null}

                      {canRestore ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={usage.used <= 0}
                          onClick={() => updateAbilityCharge(ability.id, -1)}
                        >
                          Regenerar
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {ability.description ? (
                    <div className="mt-2 whitespace-pre-wrap text-xs text-text">
                      {ability.description}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {spells.length ? (
        <div className="rounded-md border border-border p-3">
          <div className="text-xs font-medium text-textH">Magias</div>

          <div className="mt-2 grid gap-2">
            {spells.map((spell, index) => {
              const canConsume = spell.usage.reset !== "spellSlot"
              const canRestore =
                spell.usage.reset !== "spellSlot" &&
                spell.usage.reset !== "limited"

              return (
                <div
                  key={`${spell.index}-${index}`}
                  className="rounded-md border border-border p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-textH">
                        {spell.index || "Magia sem index"}
                      </div>

                      <div className="mt-1 text-xs text-text">
                        {spell.usage.reset === "spellSlot"
                          ? "Usa slot de magia"
                          : `${spell.usage.max - spell.usage.used}/${spell.usage.max} cargas`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {canConsume ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={spell.usage.used >= spell.usage.max}
                          onClick={() => updateSpellCharge(spell.index, 1)}
                        >
                          Consumir
                        </Button>
                      ) : null}

                      {canRestore ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={spell.usage.used <= 0}
                          onClick={() => updateSpellCharge(spell.index, -1)}
                        >
                          Regenerar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}