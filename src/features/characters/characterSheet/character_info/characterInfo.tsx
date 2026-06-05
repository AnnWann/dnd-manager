import { useState } from "react"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import { characterArmorClass, characterArmorClassAdjustment, equipmentBonuses } from "../../../../lib/character"
import { abilityModifier, formatSigned } from "../../../../lib/rules"
import type { CharacterTypes, InitiativeMode } from "../../../../models/types"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import { CHARACTER_TYPES, type CharacterType } from "../../../../models/characters/CharacterType"
import { SelectCharacterUniqueness } from "./components/selectCharacterUniqueness"
import { SelectCharacterVisibility } from "./components/selectCharacterVisibility"
import { SelectCharacterType } from "./components/selectCharacterType"
import { SelectCharacterOwner } from "./components/selectCharacterOwner"
import type { Player } from "../../../../models/player/Player"
import { SelectActions } from "./components/actions/selectActions"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

export function CharacterInfo({
  character,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
  getOwner,
  createOwner
}: Props) {
  const [hitDiceOpen, setHitDiceOpen] = useState(false)

  const dexMod = abilityModifier(character.attributes.dex)

  const perceptionProficiency =
  character.skills?.perception ?? "none"

  const perceptionBonus =
    abilityModifier(character.attributes.wis) +
    (perceptionProficiency === "proficient" ? 2 : 0) +
    (perceptionProficiency === "expertise" ? 4 : 0)

  const passivePerception = 10 + perceptionBonus
  const eqBonuses = equipmentBonuses(character)

  const displayedArmorClass = (character.armorClass ?? 10) + eqBonuses.armorClass
  const totalArmorClass = characterArmorClass(character)
  const displayedInitiativeBonus = (character.initiativeBonus ?? 0) + eqBonuses.initiativeBonus
  const displayedInitiative = dexMod + displayedInitiativeBonus + eqBonuses.initiative
  const displayedMaxHp = (character.maxHp ?? 0) + eqBonuses.maxHp
  const displayedCurrentHp = (character.currentHp ?? 0) + eqBonuses.currentHp
  const displayedTemporaryHp = (character.temporaryHp ?? 0) + eqBonuses.temporaryHp
  const displayedPassivePerception = passivePerception + eqBonuses.passivePerception
  const displayedMobility = (character.mobility ?? 9) + eqBonuses.mobility

  function saveBaseValue(totalValue: number, equipmentValue: number) {
    return totalValue - equipmentValue
  }

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

        <SelectCharacterType
          character={character}
          updateCharacter={updateCharacter}
          canEditCharacterType={canEditCharacterType}
        />
      </div>

      {canAssignOwners ? (
        <SelectCharacterVisibility 
          character={character}
          updateCharacter={updateCharacter}
        />
      ) : null}

      {canAssignOwners ? (
        <SelectCharacterOwner
          character={character}
          updateCharacter={updateCharacter}
          playerKeys={playerKeys}
          getOwner={getOwner}
          createOwner={createOwner}
        />
      ) : null}

      {canAssignOwners ? (
        <SelectCharacterUniqueness 
          character={character}
          updateCharacter={updateCharacter}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <SelectActions
          character={character}
          updateCharacter={updateCharacter}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <div>
          <label className="text-xs text-text">
            CA
          </label>

          <Input
            type="number"
            className="mt-1"
            value={totalArmorClass}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                armorClass: saveBaseValue(Number(e.target.value), characterArmorClassAdjustment(c)),
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
            value={formatSigned(displayedInitiative)}
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
            value={displayedInitiativeBonus}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                initiativeBonus: saveBaseValue(Number(e.target.value), eqBonuses.initiativeBonus),
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
            value={displayedMaxHp}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                maxHp: saveBaseValue(Number(e.target.value), eqBonuses.maxHp),
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
            value={displayedCurrentHp}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                currentHp: Math.max(
                  0,
                  Math.min(
                    saveBaseValue(Number(e.target.value), eqBonuses.currentHp),
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
            value={displayedTemporaryHp}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                temporaryHp: saveBaseValue(Number(e.target.value), eqBonuses.temporaryHp),
              }))
            }
          />
        </div>

        <div>
          <label className="text-xs text-text">
            Percepção Passiva
          </label>

          <Input
            className="mt-1"
            value={displayedPassivePerception}
            readOnly
          />
        </div>

        <div>
          <label className="text-xs text-text">
            Mobilidade
          </label>

          <Input
            type="number"
            className="mt-1"
            value={displayedMobility}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                mobility: saveBaseValue(Number(e.target.value), eqBonuses.mobility),
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
                  grid-cols-[56px_56px_56px_16px_72px_32px]
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
                    grid-cols-[56px_56px_56px_16px_72px_32px]
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