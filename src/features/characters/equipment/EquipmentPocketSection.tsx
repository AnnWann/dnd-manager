import { Button } from "../../../components/ui/Button"
import { attributeShort } from "../../../lib/attributeShorts"
import { formatSigned } from "../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  Itemmable,
} from "../../../models/items/item"
import type { Weapon } from "../../../models/items/equipment/Weapon"
import type { ConsumableItem, ThrowableItem } from "../../../models/items/equipment/PocketItem"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

function formatDie(die: Partial<Weapon>["damage"] | undefined) {
  if (!die) return "—"
  return `${die.quantity}${die.sides}`
}

function itemTypeLabel(item: Itemmable): string {
  if (item.kind === "equipment") {
    if (item.equipSlot === "weapon") return "Arma na bainha"
    if (item.equipSlot === "ring") return "Anel guardado"
    return "Equipamento guardado"
  }

  if (item.kind === "consumable") return "Consumível"
  if (item.kind === "throwable") return "Arremessável"

  return "Item comum"
}

function isPocketWeapon(item: Itemmable): item is Weapon {
  return item.kind === "equipment" && item.equipSlot === "weapon"
}

function isThrowable(item: Itemmable): item is ThrowableItem {
  return item.kind === "throwable"
}

function isConsumable(item: Itemmable): item is ConsumableItem {
  return item.kind === "consumable"
}

export function EquipmentPocketsSection({
  character,
  updateCharacter,
}: Props) {
  const pockets = character.get("equipment").pockets

  function unequipPocketItem(index: number) {
    updateCharacter(character.get("id"), (c) =>
      c.unequipPocketItem(index),
    )
  }

  function wieldPocketWeapon(index: number) {
    updateCharacter(character.get("id"), (c) =>
      c.wieldPocketWeapon(index),
    )
  }

  function usePocketItem(index: number) {
  updateCharacter(character.get("id"), (c) =>
    c.usePocketItem(index),
  )
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3">
        <div className="text-sm font-medium text-textH">
          Bolsos
        </div>

        <div className="text-xs text-text">
          {pockets.length}/8 bolsos usados
        </div>
      </div>

      {pockets.length === 0 ? (
        <div className="text-xs text-text">
          Nenhum item nos bolsos.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pockets.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-textH">
                    {item.name || "Item sem nome"}
                  </div>

                  <div className="mt-1 text-xs text-text">
                    {itemTypeLabel(item)} • Qtd: {item.quantity ?? 1} • Peso:{" "}
                    {item.weight ?? 0}
                  </div>

                  {isPocketWeapon(item) ? (
                    <WeaponPocketSummary
                      character={character}
                      weapon={item}
                    />
                  ) : null}

                  {isConsumable(item) && item.useText?.trim() ? (
                    <div className="mt-1 text-xs text-text">
                      Uso: {item.useText}
                    </div>
                  ) : null}

                  {isThrowable(item) ? (
                    <div className="mt-1 text-xs text-text">
                      Dano: {formatDie(item.damage)}{" "}
                      {item.range ? `• Alcance: ${item.range}` : ""}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {isPocketWeapon(item) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => wieldPocketWeapon(index)}
                    >
                      Empunhar
                    </Button>
                  ) : null}

                  {isConsumable(item) || isThrowable(item) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => usePocketItem(index)}
                    >
                      Usar
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => unequipPocketItem(index)}
                  >
                    Tirar do bolso
                  </Button>
                </div>
              </div>

              {item.desc?.trim() ? (
                <div className="mt-3">
                  <div className="text-xs font-medium text-textH">
                    Descrição
                  </div>

                  <div className="mt-1 whitespace-pre-wrap text-xs text-text">
                    {item.desc}
                  </div>
                </div>
              ) : null}

              {isPocketWeapon(item) && item.properties?.length ? (
                <div className="mt-3">
                  <div className="text-xs font-medium text-textH">
                    Propriedades
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.properties.map((property) => (
                      <span
                        key={property.id}
                        title={property.desc}
                        className="rounded-md border border-border px-2 py-1 text-xs text-text"
                      >
                        {property.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeaponPocketSummary({
  character,
  weapon,
}: {
  character: CharacterTemplate
  weapon: Weapon
}) {
  const attribute = weapon.modifierAttribute ?? "str"
  const attributeMod = character.getEffectiveAttributeModifier(attribute)

  const proficiency = weapon.proficient
    ? character.getProficiencyBonus()
    : 0

  const attackBonus = character.getEffectiveWeaponAttackBonus(
    weapon,
    attributeMod + proficiency,
  )

  const damageBonus = character.getEffectiveWeaponDamageBonus(
    weapon,
    attributeMod,
  )

  return (
    <>
      <div className="mt-1 text-xs text-text">
        Dano base: {formatDie(weapon.damage)}
        {" • "}
        Atributo: {attributeShort(attribute)}
        {" • "}
        {weapon.proficient ? "Proficiente" : "Não proficiente"}
      </div>

      <div className="mt-1 text-xs text-text">
        Ataque: {formatSigned(attackBonus)}
        {" • "}
        Dano: {formatDie(weapon.damage)}
        {damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""}
      </div>

      <div className="mt-1 text-xs text-text">
        {weapon.twoHanded ? "Duas mãos" : "Uma mão"}
      </div>
    </>
  )
}