import { useState } from "react"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { characterArmorClass, characterArmorClassAdjustment, equipmentBonuses } from "../../../lib/character"
import { abilityModifier, formatSigned } from "../../../lib/rules"
import type { Character, CharacterTypes, InitiativeMode } from "../../../models/types"

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
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
}

export function CharacterInfo({
  character,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
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

        <div className="w-full md:w-[320px]">
          <label className="text-xs text-text">
            Tipo
          </label>

          <Select
            className="mt-1"
            value={character.type}
            disabled={!canEditCharacterType}
            onChange={(e) =>
              canEditCharacterType
                ?
              updateCharacter(character.id, (c) => ({
                ...c,
                type: e.target.value as CharacterTypes,
              }))
                : undefined
            }
          >
            {(canEditCharacterType ? CHARACTER_TYPES : [character.type]).map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {canAssignOwners ? (
        <div className="w-full md:w-[320px]">
          <label className="text-xs text-text">
            Visibilidade
          </label>

          <Select
            className="mt-1"
            value={character.visibilityRole ?? 'player'}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                visibilityRole: e.target.value as 'master' | 'player',
              }))
            }
          >
            <option value="player">Player</option>
            <option value="master">Master</option>
          </Select>
        </div>
      ) : null}

      {canAssignOwners ? (
        <div className="w-full md:w-[320px]">
          <label className="text-xs text-text">
            Jogador atribuído
          </label>

          <Select
            className="mt-1"
            value={character.ownerKey ?? ''}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                ownerKey: e.target.value,
              }))
            }
          >
            <option value="">Sem jogador</option>
            {playerKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </Select>

          <Input
            className="mt-2"
            value={character.ownerKey ?? ''}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                ownerKey: e.target.value,
              }))
            }
            placeholder="Ou digite um novo nome de jogador"
          />
        </div>
      ) : null}

      {canAssignOwners ? (
        <div className="w-full md:w-[320px]">
          <label className="text-xs text-text">Modo de Iniciativa</label>

          <Select
            className="mt-1"
            value={character.initiativeMode ?? (character.type === 'pc' ? 'unique' : 'general')}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                initiativeMode: e.target.value as InitiativeMode,
              }))
            }
          >
            <option value="unique">Único</option>
            <option value="general">Geral</option>
          </Select>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="text-xs text-text">Ações</label>
          <Input
            type="number"
            className="mt-1"
            value={character.actionsPerTurn ?? 1}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                actionsPerTurn: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-text">Ações bônus</label>
          <Input
            type="number"
            className="mt-1"
            value={character.bonusActionsPerTurn ?? 1}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                bonusActionsPerTurn: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-text">Reações</label>
          <Input
            type="number"
            className="mt-1"
            value={character.reactionsPerTurn ?? 1}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                reactionsPerTurn: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-text">Ações lendárias</label>
          <Input
            type="number"
            className="mt-1"
            value={character.legendaryActions ?? 0}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                legendaryActions: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-text">Reações lendárias</label>
          <Input
            type="number"
            className="mt-1"
            value={character.legendaryReactions ?? 0}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                legendaryReactions: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-text">Resistências lendárias</label>
          <Input
            type="number"
            className="mt-1"
            value={character.legendaryResistances ?? 0}
            onChange={(e) =>
              updateCharacter(character.id, (c) => ({
                ...c,
                legendaryResistances: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
              }))
            }
          />
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