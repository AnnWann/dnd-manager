import { Button } from "../../../components/ui/Button"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import type { Itemmable } from "../../../models/items/item"

export function ItemDropdownDetails({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const equipment = item.kind === "equipment" ? (item as Equipment) : null

  function updateAbilityCharge(abilityId: string, delta: number) {
    onUpdate((current) => {
      const equipment = current as Equipment

      return {
        ...equipment,
        abilities: (equipment.abilities ?? []).map((ability) => {
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
      }
    })
  }

  function updateSpellCharge(spellIndex: string, delta: number) {
    onUpdate((current) => {
      const equipment = current as Equipment

      return {
        ...equipment,
        spells: (equipment.spells ?? []).map((spell) => {
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
      }
    })
  }

  return (
    <div className="mt-3 grid gap-3 text-sm text-text">
      {item.desc ? (
        <div>
          <div className="text-xs font-medium text-textH">Descrição</div>
          <p className="mt-1 whitespace-pre-wrap">{item.desc}</p>
        </div>
      ) : null}

      {item.notes ? (
        <div>
          <div className="text-xs font-medium text-textH">Notas</div>
          <p className="mt-1 whitespace-pre-wrap">{item.notes}</p>
        </div>
      ) : null}

      {equipment?.abilities?.length ? (
        <div>
          <div className="text-xs font-medium text-textH">Habilidades</div>

          <div className="mt-2 grid gap-2">
            {equipment.abilities.map((ability) => {
              const usage = ability.usage
              const canConsume = usage && usage.reset !== "spellSlot"
              const canRestore =
                usage &&
                usage.reset !== "spellSlot" &&
                usage.reset !== "limited"

              return (
                <div
                  key={ability.id}
                  className="rounded-lg border border-border p-2"
                >
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

                    {usage ? (
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
                    ) : null}
                  </div>

                  {ability.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-text">
                      {ability.description}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {equipment?.spells?.length ? (
        <div>
          <div className="text-xs font-medium text-textH">Magias</div>

          <div className="mt-2 grid gap-2">
            {equipment.spells.map((spell, index) => {
              const usage = spell.usage
              const canConsume = usage.reset !== "spellSlot"
              const canRestore =
                usage.reset !== "spellSlot" && usage.reset !== "limited"

              return (
                <div
                  key={`${spell.index}-${index}`}
                  className="rounded-lg border border-border p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-textH">
                        {spell.index || "Magia sem index"}
                      </div>

                      <div className="mt-1 text-xs text-text">
                        {usage.reset === "spellSlot"
                          ? "Usa slot de magia"
                          : `${usage.max - usage.used}/${usage.max} cargas`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {canConsume ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={usage.used >= usage.max}
                          onClick={() => updateSpellCharge(spell.index, 1)}
                        >
                          Consumir
                        </Button>
                      ) : null}

                      {canRestore ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={usage.used <= 0}
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