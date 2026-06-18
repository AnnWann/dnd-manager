import { useEffect, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { ATTRIBUTES, DIE_SIDES } from "../../../contexts/consts"
import type { DieSides } from "../../../models/dice/Die"
import type { Armor } from "../../../models/items/equipment/Armor"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import type { Weapon } from "../../../models/items/equipment/Weapon"
import type { EquipSlot, Itemmable } from "../../../models/items/item"
import type { Ability, AbilityActionKind, AbilityKind, AbilityUsageResetKind, Trigger } from "../../../models/abilities/Ability"
import type { Attribute } from "../../../models/sheet/Attribute"

export function EquipmentFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  
  return (
    <>
      <div className="grid gap-2 md:col-span-3">
        <label className="text-xs text-text">Slot</label>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {[
            ["armor", "Armadura"],
            ["helmet", "Capacete"],
            ["gloves", "Luvas"],
            ["boots", "Botas"],
            ["weapon", "Arma"],
            ["ring", "Anel"],
            ["cape", "Capa"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                item.equipSlot === value
                  ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs font-medium text-background"
                  : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
              }
              onClick={() =>
                onUpdate((current) =>
                  withEquipmentDefaults(current, value as EquipSlot),
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {item.equipSlot === "armor" ? (
        <div className="grid gap-2 md:col-span-3">
          <label className="text-xs text-text">Tipo de armadura</label>

          <div className="grid grid-cols-3 gap-2">
            {[
              ["light", "Leve"],
              ["medium", "Média"],
              ["heavy", "Pesada"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  (item as Partial<Armor>).armorType === value
                    ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs font-medium text-background"
                    : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
                }
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    armorType: value as Armor["armorType"],
                  }))
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {item.equipSlot === "weapon" ? (
        <WeaponFields item={item} onUpdate={onUpdate} />
      ) : null}

      <EquipmentAbilitiesFields item={item} onUpdate={onUpdate} />
      <EquipmentSpellsFields item={item} onUpdate={onUpdate} />
    </>
  )
}

export function WeaponFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const weapon = item as Partial<Weapon>

  return (
    <div className="grid gap-3 md:col-span-3 md:grid-cols-4">
      <div className="grid gap-2">
        <label className="text-xs text-text">Qtd. dados</label>

        <Input
          type="number"
          min={1}
          value={weapon.damage?.quantity ?? 1}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              damage: {
                quantity: Number(e.target.value) || 1,
                sides: weapon.damage?.sides ?? "d6",
              },
            }))
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Dado</label>

        <Select
          value={weapon.damage?.sides ?? "d6"}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              damage: {
                quantity: weapon.damage?.quantity ?? 1,
                sides: e.target.value as DieSides,
              },
            }))
          }
        >
          {DIE_SIDES.map((side) => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Atributo</label>

        <Select
          value={weapon.modifierAttribute ?? "str"}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              modifierAttribute: e.target.value as Attribute,
            }))
          }
        >
          {ATTRIBUTES.map((attribute) => (
            <option key={attribute.value} value={attribute.value}>
              {attribute.label}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={weapon.twoHanded ?? false}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              twoHanded: e.target.checked,
            }))
          }
        />
        Duas mãos
      </label>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={weapon.proficient ?? false}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              proficient: e.target.checked,
            }))
          }
        />
        Proficiente
      </label>
    </div>
  )
}

const DEFAULT_ABILITY: Ability = {
  id: "",
  name: "",
  description: "",
  kind: "active",
  actionKind: "action",
  trigger: "always",
  usage: {
    max: 1,
    used: 0,
    reset: "longRest",
  },
}

function EquipmentAbilitiesFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {

  const [creatingAbility, setCreatingAbility] = useState(false)
  const [editingAbilityIndex, setEditingAbilityIndex] = useState<number | null>(null)

  const equipment = item as Equipment

  const editingAbility =
    editingAbilityIndex === null
      ? null
      : equipment.abilities?.[editingAbilityIndex] ?? null

  function updateAbilityAt(index: number, ability: Ability) {
    onUpdate((current) => {
      const abilities = [...((current as Equipment).abilities ?? [])]
      abilities[index] = ability
      return { ...current, abilities }
    })
  }

  return (
    <div className="grid gap-3 md:col-span-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-textH">Habilidades</label>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setCreatingAbility(true)}
        >
          + Habilidade
        </Button>
      </div>

      {(equipment.abilities ?? []).map((ability, index) => (
        <div
          key={ability.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div>
            <div className="text-sm font-medium text-textH">
              {ability.name || "Habilidade sem nome"}
            </div>

            <div className="text-xs text-text">
              {ability.usage
                ? ability.usage.reset === "spellSlot"
                  ? "Usa slot de magia"
                  : `${ability.usage.max - ability.usage.used}/${ability.usage.max} cargas`
                : "Sem cargas"}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditingAbilityIndex(index)}
            >
              Editar
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                onUpdate((current) => ({
                  ...current,
                  abilities: ((current as Equipment).abilities ?? []).filter(
                    (_, currentIndex) => currentIndex !== index,
                  ),
                }))
              }
            >
              Remover
            </Button>
          </div>
        </div>
      ))}

      <AbilityEditPopup
        open={creatingAbility}
        ability={{
          id: crypto.randomUUID(),
          name: "",
          description: "",
          kind: "active",
          actionKind: "action",
          trigger: "always",
        }}
        onClose={() => setCreatingAbility(false)}
        onSave={(ability) => {
          onUpdate((current) => ({
            ...current,
            abilities: [
              ...((current as Equipment).abilities ?? []),
              ability,
            ],
          }))

          setCreatingAbility(false)
        }}
      />

      <AbilityEditPopup
        open={editingAbilityIndex !== null}
        ability={
          editingAbilityIndex === null
            ? null
            : equipment.abilities?.[editingAbilityIndex] ?? null
        }
        onClose={() => setEditingAbilityIndex(null)}
        onSave={(ability) => {
          if (editingAbilityIndex === null) return

          onUpdate((current) => {
            const abilities = [...((current as Equipment).abilities ?? [])]

            abilities[editingAbilityIndex] = ability

            return {
              ...current,
              abilities,
            }
          })

          setEditingAbilityIndex(null)
        }}
      />
    </div>
  )
}

function AbilityEditPopup({
  open,
  ability,
  onClose,
  onSave,
}: {
  open: boolean
  ability: Ability | null
  onClose: () => void
  onSave: (ability: Ability) => void
}) {
  const [draft, setDraft] = useState<Ability | null>(null)

  useEffect(() => {
    if (open && ability) {
      setDraft(ability)
    }

    if (!open) {
      setDraft(null)
    }
  }, [open, ability])

  if (!open || !ability || !draft) return null

  function patch(patch: Partial<Ability>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const usage = draft.usage

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-auto rounded-xl border border-border bg-background p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-textH">
            Editar habilidade
          </h2>

          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <Input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Nome da habilidade"
        />

        <Textarea
          rows={3}
          value={draft.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Descrição"
        />

        <div className="grid gap-2 md:grid-cols-3">
          <Select
            value={draft.kind ?? "active"}
            onChange={(e) => patch({ kind: e.target.value as AbilityKind })}
          >
            <option value="active">Ativa</option>
            <option value="passive">Passiva</option>
          </Select>

          <Select
            value={draft.actionKind ?? "action"}
            onChange={(e) =>
              patch({ actionKind: e.target.value as AbilityActionKind })
            }
          >
            <option value="action">Ação</option>
            <option value="bonusAction">Ação bônus</option>
            <option value="reaction">Reação</option>
            <option value="free">Livre</option>
          </Select>

          <Select
            value={draft.trigger ?? "always"}
            onChange={(e) => patch({ trigger: e.target.value as Trigger })}
          >
            <option value="always">Sempre</option>
            <option value="onAttack">Ao atacar</option>
            <option value="onHit">Ao acertar</option>
            <option value="onCrit">Ao critar</option>
            <option value="whenHit">Quando atingido</option>
            <option value="onSpellCast">Ao conjurar magia</option>
            <option value="onInitiative">Na iniciativa</option>
          </Select>
        </div>

        <div className="grid gap-2 rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={usage !== undefined}
              onChange={(e) =>
                patch({
                  usage: e.target.checked
                    ? { max: 1, used: 0, reset: "longRest" }
                    : undefined,
                })
              }
            />
            Usa cargas
          </label>

          {usage ? (
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                type="number"
                min={0}
                value={usage.max}
                onChange={(e) => {
                  const max = Number(e.target.value) || 0
                  patch({
                    usage: {
                      ...usage,
                      max,
                      used: Math.min(usage.used, max),
                    },
                  })
                }}
              />

              <Input
                type="number"
                min={0}
                max={usage.max}
                value={usage.used}
                onChange={(e) =>
                  patch({
                    usage: {
                      ...usage,
                      used: Math.min(usage.max, Number(e.target.value) || 0),
                    },
                  })
                }
              />

              <Select
                value={usage.reset}
                onChange={(e) =>
                  patch({
                    usage: {
                      ...usage,
                      reset: e.target.value as AbilityUsageResetKind,
                    },
                  })
                }
              >
                <option value="turn">Turno</option>
                <option value="cooldown">Cooldown</option>
                <option value="shortRest">Descanso curto</option>
                <option value="longRest">Descanso longo</option>
                <option value="limited">Limitado / não restaura</option>
                <option value="spellSlot">Slot de magia</option>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <Button size="sm" variant="primary" onClick={() => onSave(draft)}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}

function EquipmentSpellsFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const equipment = item as Equipment

  return (
    <div className="grid gap-3 md:col-span-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-textH">Magias</label>

        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onUpdate((current) => ({
              ...current,
              spells: [
                ...((current as Equipment).spells ?? []),
                {
                  index: "",
                  usage: {
                    max: 1,
                    used: 0,
                    reset: "longRest",
                  },
                },
              ],
            }))
          }
        >
          + Magia
        </Button>
      </div>

      {(equipment.spells ?? []).map((spell, index) => (
        <div
          key={`${spell.index}-${index}`}
          className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_90px_130px_auto]"
        >
          <Input
            value={spell.index}
            onChange={(e) =>
              onUpdate((current) => {
                const spells = [...(((current as Equipment).spells) ?? [])]
                spells[index] = { ...spells[index], index: e.target.value }
                return { ...current, spells }
              })
            }
            placeholder="Index da magia. Ex.: misty-step"
          />

          <Input
            type="number"
            min={0}
            value={spell.usage.max}
            onChange={(e) =>
              onUpdate((current) => {
                const spells = [...(((current as Equipment).spells) ?? [])]
                spells[index] = {
                  ...spells[index],
                  usage: {
                    ...spells[index].usage,
                    max: Number(e.target.value) || 0,
                  },
                }
                return { ...current, spells }
              })
            }
          />

          <Select
            value={spell.usage.reset}
            onChange={(e) =>
              onUpdate((current) => {
                const spells = [...(((current as Equipment).spells) ?? [])]
                spells[index] = {
                  ...spells[index],
                  usage: {
                    ...spells[index].usage,
                    reset: e.target.value as any,
                  },
                }
                return { ...current, spells }
              })
            }
          >
            <option value="shortRest">Descanso curto</option>
            <option value="longRest">Descanso longo</option>
            <option value="limited">Limitado</option>
            <option value="spellSlot">Slot de magia</option>
          </Select>

          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onUpdate((current) => ({
                ...current,
                spells: ((current as Equipment).spells ?? []).filter(
                  (_, currentIndex) => currentIndex !== index,
                ),
              }))
            }
          >
            Remover
          </Button>
        </div>
      ))}
    </div>
  )
}

export function withEquipmentDefaults(
    item: Itemmable,
    equipSlot: EquipSlot,
  ): Itemmable {
    const base = {
      ...item,
      kind: "equipment" as const,
      equippable: true,
      equipSlot,
      pocketable: equipSlot === "weapon" || equipSlot === "ring",
    }
  
    if (equipSlot === "weapon") {
      return withWeaponDefaults(base)
    }
  
    if (equipSlot === "armor") {
      return {
        ...base,
        armorType: (item as Partial<Armor>).armorType ?? "light",
      }
    }
  
    return {
      ...base,
      armorType: undefined,
    }
  }

  function withWeaponDefaults(item: Itemmable): Itemmable {
    const weapon = item as Partial<Weapon>
  
    return {
      ...item,
      properties: weapon.properties ?? [],
      twoHanded: weapon.twoHanded ?? false,
      damage: weapon.damage ?? {
        quantity: 1,
        sides: "d6",
      },
      modifierAttribute: weapon.modifierAttribute ?? "str",
      proficient: weapon.proficient ?? false,
    }
  }