import { useState } from "react"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { abilityModifier, formatSigned } from "../../../lib/rules"
import type { Character, CharacterTypes } from "../../../types"

export const CHARACTER_TYPES: CharacterTypes[] = [
  "pc",
  "npc",
  "besta",
  "humanoide",
  "monstruosidade",
  "morto-vivo",
  "constructo",
  "elemental",
  "féerico",
  "corruptor",
  "gigante",
  "dragão",
  "celestial",
  "aberração",
  "gosma",
]

type Props = {
  character: Character
  updateCharacter: (
    characterId: string,
    updater: (c: Character) => Character
  ) => void
}

export function CharacterInfo({ character, updateCharacter }: Props) {
  const [hitDiceOpen, setHitDiceOpen] = useState(false)

  const dexMod = abilityModifier(character.attributes.dex)
  const initiative = dexMod + (character.initiativeBonus ?? 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full">
          <label className="text-xs text-text">
            Nome do personagem
          </label>

          <Input
            className="mt-1"
            value={character.name}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                name: e.target.value,
              }))
            }
          />
        </div>

        <div className="w-full md:w-[320px]">
          <label className="text-xs text-text">
            Tipo
          </label>

          <Select
            className="mt-1"
            value={character.type}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                type: e.target.value as CharacterTypes,
              }))
            }
          >
            {CHARACTER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <div>
          <label className="text-xs text-text">
            CA
          </label>

          <Input
            type="number"
            className="mt-1"
            value={character.armorClass ?? 10}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                armorClass: Number(e.target.value),
              }))
            }
          />
        </div>

        <div>
          <label className="text-xs text-text">
            Iniciativa
          </label>

          <Input
            className="mt-1"
            value={formatSigned(initiative)}
            readOnly
          />
        </div>

        <div>
          <label className="text-xs text-text">
            Bônus Inic.
          </label>

          <Input
            type="number"
            className="mt-1"
            value={character.initiativeBonus ?? 0}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                initiativeBonus: Number(e.target.value),
              }))
            }
          />
        </div>

        <div>
          <label className="text-xs text-text">
            HP Máx.
          </label>

          <Input
            type="number"
            className="mt-1"
            value={character.maxHp ?? 0}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                maxHp: Number(e.target.value),
              }))
            }
          />
        </div>

        <div>
          <label className="text-xs text-text">
            HP Atual
          </label>

          <Input
            type="number"
            className="mt-1"
            value={character.currentHp ?? 0}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                currentHp: Math.max(
                  0,
                  Math.min(
                    Number(e.target.value),
                    c.maxHp ?? 0,
                  ),
                ),
              }))
            }
          />
        </div>

        <div>
          <label className="text-xs text-text">
            HP Temp.
          </label>

          <Input
            type="number"
            className="mt-1"
            value={character.temporaryHp ?? 0}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                temporaryHp: Number(e.target.value),
              }))
            }
          />
        </div>

        <div className="col-span-2 lg:col-span-3">
          <button
            type="button"
            onClick={() => setHitDiceOpen((v) => !v)}
            className="
              flex items-center gap-2
              text-xs font-medium text-textH
              hover:opacity-80
            "
          >
            <span>{hitDiceOpen ? "▼" : "▶"}</span>
            <span>Dados de Vida</span>
          </button>

          {hitDiceOpen && (
            <div className="mt-2 flex flex-col gap-2">
              <div
                className="
                  mb-1 grid
                  grid-cols-[56px_56px_56px_16px_56px_32px]
                  gap-2 px-1
                  text-[10px] uppercase tracking-wide text-text
                "
              >
                <div className="text-center">Máx</div>
                <div className="text-center">Atual</div>
                <div className="text-center">Qtd</div>
                <div />
                <div className="text-center">Dado</div>
                <div />
              </div>

              {(character.hitDice ?? []).map((hd, index) => (
                <div
                  key={index}
                  className="
                    grid
                    grid-cols-[56px_56px_56px_16px_56px_32px]
                    items-center gap-2
                  "
                >
                  <Input
                    type="number"
                    className="w-full"
                    title="Quantidade máxima"
                    value={hd.max}
                    onChange={(e) =>
                      updateCharacter(character.id, (c) => {
                        const next = [...(c.hitDice ?? [])]
                        const max = Number(e.target.value)

                        next[index] = {
                          ...next[index],
                          max,
                          current: Math.min(
                            next[index].current,
                            max,
                          ),
                        }

                        return {
                          ...c,
                          hitDice: next,
                        }
                      })
                    }
                  />

                  <Input
                    type="number"
                    className="w-full"
                    title="Quantidade atual"
                    value={hd.current}
                    onChange={(e) =>
                      updateCharacter(character.id, (c) => {
                        const next = [...(c.hitDice ?? [])]

                        next[index] = {
                          ...next[index],
                          current: Math.min(
                            Number(e.target.value),
                            next[index].max,
                          ),
                        }

                        return {
                          ...c,
                          hitDice: next,
                        }
                      })
                    }
                  />

                  <Input
                    type="number"
                    className="w-full"
                    title="Número de dados"
                    value={hd.dice ?? 1}
                    onChange={(e) =>
                      updateCharacter(character.id, (c) => {
                        const next = [...(c.hitDice ?? [])]

                        next[index] = {
                          ...next[index],
                          dice: Number(e.target.value),
                        }

                        return {
                          ...c,
                          hitDice: next,
                        }
                      })
                    }
                  />

                  <span className="text-center text-sm text-text">
                    d
                  </span>

                  <Input
                    type="number"
                    className="w-full"
                    title="Valor do dado"
                    value={hd.diceValue}
                    onChange={(e) =>
                      updateCharacter(character.id, (c) => {
                        const next = [...(c.hitDice ?? [])]

                        next[index] = {
                          ...next[index],
                          diceValue: Number(e.target.value),
                        }

                        return {
                          ...c,
                          hitDice: next,
                        }
                      })
                    }
                  />

                  <button
                    type="button"
                    className="
                      rounded-md border border-border
                      px-2 py-1 text-xs text-text
                    "
                    onClick={() =>
                      updateCharacter(character.id, (c) => ({
                        ...c,
                        hitDice: (c.hitDice ?? []).filter(
                          (_, i) => i !== index,
                        ),
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="
                  w-fit rounded-md border border-border
                  px-2 py-1 text-xs text-text
                "
                onClick={() =>
                  updateCharacter(character.id, (c) => ({
                    ...c,
                    hitDice: [
                      ...(c.hitDice ?? []),
                      {
                        max: 1,
                        current: 1,
                        dice: 1,
                        diceValue: 8,
                      },
                    ],
                  }))
                }
              >
                + Adicionar dado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}