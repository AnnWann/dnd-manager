from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


def replace_regex(
    text: str,
    pattern: str,
    replacement: str,
    label: str,
    flags: int = 0,
) -> str:
    updated, count = re.subn(
        pattern,
        lambda _match: replacement,
        text,
        count=1,
        flags=flags,
    )
    if count != 1:
        raise SystemExit(f"{label} matched {count} times")
    return updated


# ---------------------------------------------------------------------------
# Weapon editor: own attack bonus, versatile property and alternate damage.
# ---------------------------------------------------------------------------
path = "src/features/characters/inventory/equipmentFields.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { DieSides } from "../../../models/dice/Die"',
    'import type { Die, DieSides } from "../../../models/dice/Die"',
    "die type import",
)
text = replace_once(
    text,
    'import type { Weapon } from "../../../models/items/equipment/Weapon"',
    'import {\n  WEAPON_PROPERTIES,\n  hasWeaponProperty,\n  type Weapon,\n} from "../../../models/items/equipment/Weapon"',
    "weapon helpers import",
)

weapon_fields = '''export function WeaponFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const weapon = item as Partial<Weapon>
  const versatile = hasWeaponProperty(weapon, "versatile")
  const ownAttackBonus = (() => {
    const bonus = weapon.bonuses?.attack?.bonus
    if (!bonus) return 0
    if (bonus.type === "sub") return -Math.abs(bonus.value)
    return bonus.value
  })()

  function setOwnAttackBonus(value: number) {
    onUpdate((current) => {
      const currentEquipment = current as Equipment
      const bonuses = { ...(currentEquipment.bonuses ?? {}) }

      if (value === 0) {
        delete bonuses.attack
      } else {
        bonuses.attack = {
          type: "equipment",
          bonus: {
            type: value < 0 ? "sub" : "add",
            value: Math.abs(value),
          },
        }
      }

      return {
        ...current,
        bonuses,
      }
    })
  }

  function setTwoHanded(enabled: boolean) {
    onUpdate((current) => {
      const currentWeapon = current as Partial<Weapon>
      const properties = (currentWeapon.properties ?? []).filter(
        (property) => property.id !== "two-handed" && property.id !== "versatile",
      )

      if (enabled) properties.push(WEAPON_PROPERTIES["two-handed"])

      return {
        ...current,
        properties,
        twoHanded: enabled,
        wieldedTwoHanded: enabled,
        versatileDamage: undefined,
      }
    })
  }

  function setVersatile(enabled: boolean) {
    onUpdate((current) => {
      const currentWeapon = current as Partial<Weapon>
      const properties = (currentWeapon.properties ?? []).filter(
        (property) => property.id !== "two-handed" && property.id !== "versatile",
      )

      if (enabled) properties.push(WEAPON_PROPERTIES.versatile)

      const baseDamage = currentWeapon.damage ?? {
        quantity: 1,
        sides: "d6" as DieSides,
      }

      return {
        ...current,
        properties,
        twoHanded: false,
        wieldedTwoHanded: enabled
          ? (currentWeapon.wieldedTwoHanded ?? false)
          : false,
        versatileDamage: enabled
          ? (currentWeapon.versatileDamage ?? { ...baseDamage })
          : undefined,
      }
    })
  }

  return (
    <div className="grid gap-3 md:col-span-3 md:grid-cols-4">
      <WeaponDamageFields
        title={versatile ? "Dano com uma mão" : "Dano"}
        die={weapon.damage ?? { quantity: 1, sides: "d6" }}
        onChange={(damage) =>
          onUpdate((current) => ({
            ...current,
            damage,
          }))
        }
      />

      <div className="grid gap-2">
        <label className="text-xs text-text">Atributo</label>
        <Select
          value={weapon.modifierAttribute ?? "str"}
          onChange={(event) =>
            onUpdate((current) => ({
              ...current,
              modifierAttribute: event.target.value as Attribute,
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

      <div className="grid gap-2">
        <label className="text-xs text-text">Bônus próprio de ataque</label>
        <Input
          type="number"
          value={ownAttackBonus}
          onChange={(event) =>
            setOwnAttackBonus(Number(event.target.value) || 0)
          }
        />
      </div>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={weapon.twoHanded ?? false}
          onChange={(event) => setTwoHanded(event.target.checked)}
        />
        Exige duas mãos
      </label>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={versatile}
          onChange={(event) => setVersatile(event.target.checked)}
        />
        Versátil
      </label>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={weapon.proficient ?? false}
          onChange={(event) =>
            onUpdate((current) => ({
              ...current,
              proficient: event.target.checked,
            }))
          }
        />
        Proficiente
      </label>

      {versatile ? (
        <WeaponDamageFields
          title="Dano com duas mãos"
          die={
            weapon.versatileDamage ??
            weapon.damage ?? { quantity: 1, sides: "d6" }
          }
          onChange={(versatileDamage) =>
            onUpdate((current) => ({
              ...current,
              versatileDamage,
            }))
          }
        />
      ) : null}
    </div>
  )
}

function WeaponDamageFields({
  title,
  die,
  onChange,
}: {
  title: string
  die: Die
  onChange: (die: Die) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:col-span-2">
      <div className="grid gap-2">
        <label className="text-xs text-text">{title}: qtd. dados</label>
        <Input
          type="number"
          min={1}
          value={die.quantity}
          onChange={(event) =>
            onChange({
              ...die,
              quantity: Number(event.target.value) || 1,
            })
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">{title}: dado</label>
        <Select
          value={die.sides}
          onChange={(event) =>
            onChange({
              ...die,
              sides: event.target.value as DieSides,
            })
          }
        >
          {DIE_SIDES.map((side) => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}'''
text = replace_regex(
    text,
    r'export function WeaponFields\(\{.*?\n\}\n\n(?=function EquipmentAbilitiesFields)',
    weapon_fields + "\n\n",
    "weapon fields block",
    re.S,
)

weapon_defaults = '''function withWeaponDefaults(item: Itemmable): Itemmable {
  const weapon = item as Partial<Weapon>
  const properties = [...(weapon.properties ?? [])]
  const versatile =
    properties.some((property) => property.id === "versatile") ||
    Boolean(weapon.versatileDamage)

  if (versatile && !properties.some((property) => property.id === "versatile")) {
    properties.push(WEAPON_PROPERTIES.versatile)
  }

  if (
    !versatile &&
    weapon.twoHanded &&
    !properties.some((property) => property.id === "two-handed")
  ) {
    properties.push(WEAPON_PROPERTIES["two-handed"])
  }

  const damage = weapon.damage ?? {
    quantity: 1,
    sides: "d6" as DieSides,
  }

  return {
    ...item,
    properties: properties.filter((property) =>
      versatile ? property.id !== "two-handed" : property.id !== "versatile",
    ),
    twoHanded: versatile ? false : (weapon.twoHanded ?? false),
    wieldedTwoHanded: versatile
      ? (weapon.wieldedTwoHanded ?? false)
      : (weapon.twoHanded ?? false),
    damage,
    versatileDamage: versatile
      ? (weapon.versatileDamage ?? { ...damage })
      : undefined,
    modifierAttribute: weapon.modifierAttribute ?? "str",
    proficient: weapon.proficient ?? false,
  }
}'''
text = replace_regex(
    text,
    r'function withWeaponDefaults\(item: Itemmable\): Itemmable \{.*?\n\}',
    weapon_defaults,
    "weapon defaults",
    re.S,
)
write(path, text)


# ---------------------------------------------------------------------------
# Character weapon conversion and hand accounting.
# ---------------------------------------------------------------------------
path = "src/models/characters/characterEquipment.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Weapon } from "../items/equipment/Weapon"',
    'import {\n  WEAPON_PROPERTIES,\n  getWeaponHandsUsed,\n  hasWeaponProperty,\n  type Weapon,\n} from "../items/equipment/Weapon"',
    "character equipment weapon import",
)

to_weapon = '''function toWeapon(item: Itemmable): Weapon {
  const weapon = item as Partial<Weapon>
  const properties = [...(weapon.properties ?? [])]
  const versatile =
    hasWeaponProperty(weapon, "versatile") || Boolean(weapon.versatileDamage)

  if (versatile && !properties.some((property) => property.id === "versatile")) {
    properties.push(WEAPON_PROPERTIES.versatile)
  }

  const damage = weapon.damage ?? {
    quantity: 1,
    sides: "d6",
  }

  return {
    ...item,
    kind: "equipment",
    equippable: true,
    equipSlot: "weapon",
    properties: properties.filter((property) =>
      versatile ? property.id !== "two-handed" : property.id !== "versatile",
    ),
    twoHanded: versatile ? false : (weapon.twoHanded ?? false),
    wieldedTwoHanded: versatile
      ? (weapon.wieldedTwoHanded ?? false)
      : (weapon.twoHanded ?? false),
    damage,
    versatileDamage: versatile
      ? (weapon.versatileDamage ?? { ...damage })
      : undefined,
    modifierAttribute: weapon.modifierAttribute ?? "str",
    proficient: weapon.proficient ?? false,
  } as Weapon
}'''
text = replace_regex(
    text,
    r'function toWeapon\(item: Itemmable\): Weapon \{.*?\n\}',
    to_weapon,
    "character equipment toWeapon",
    re.S,
)
text = re.sub(
    r'([A-Za-z][A-Za-z0-9_]*)\.twoHanded \? 2 : 1',
    lambda match: f'getWeaponHandsUsed({match.group(1)})',
    text,
)
if ".twoHanded ? 2 : 1" in text:
    raise SystemExit("unconverted character equipment hand expression")
write(path, text)


# ---------------------------------------------------------------------------
# Shield-aware weapon interactions and hand accounting.
# ---------------------------------------------------------------------------
path = "src/models/characters/characterEquipmentInteractions.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Weapon } from "../items/equipment/Weapon"',
    'import {\n  WEAPON_PROPERTIES,\n  getWeaponHandsUsed,\n  hasWeaponProperty,\n  type Weapon,\n} from "../items/equipment/Weapon"',
    "equipment interactions weapon import",
)
text = re.sub(
    r'([A-Za-z][A-Za-z0-9_]*)\.twoHanded \? 2 : 1',
    lambda match: f'getWeaponHandsUsed({match.group(1)})',
    text,
)
text = replace_regex(
    text,
    r'function toWeapon\(item: Itemmable\): Weapon \{.*?\n\}',
    to_weapon,
    "equipment interactions toWeapon",
    re.S,
)
if ".twoHanded ? 2 : 1" in text:
    raise SystemExit("unconverted equipment interactions hand expression")
write(path, text)


# ---------------------------------------------------------------------------
# Equipped weapon card: grip selector and active damage die.
# ---------------------------------------------------------------------------
path = "src/features/characters/equipment/EquipmentWeaponsSection.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Weapon } from "../../../models/items/equipment/Weapon"',
    'import {\n  getWeaponDamageDie,\n  getWeaponHandsUsed,\n  isVersatileWeapon,\n  type Weapon,\n} from "../../../models/items/equipment/Weapon"',
    "equipment weapon helpers import",
)

weapons_component = '''export function EquipmentWeaponsSection({
  character,
  updateCharacter,
}: Props) {
  const weapons = character.get("equipment").weapons
  const usedHands = getUsedArmsIncludingShield(character)
  const totalHands = character.get("sheet").arms

  function unequipWeapon(index: number) {
    updateCharacter(character.get("id"), (c) => c.unequipWeapon(index))
  }

  function setWeaponGrip(index: number, wieldedTwoHanded: boolean) {
    updateCharacter(character.get("id"), (current) => {
      const equipment = current.get("equipment")
      const weapon = equipment.weapons[index]
      if (!weapon || !isVersatileWeapon(weapon)) return current

      const nextWeapon: Weapon = {
        ...weapon,
        twoHanded: false,
        wieldedTwoHanded,
      }
      const nextUsedHands =
        getUsedArmsIncludingShield(current) -
        getWeaponHandsUsed(weapon) +
        getWeaponHandsUsed(nextWeapon)

      if (nextUsedHands > current.get("sheet").arms) return current

      return current.updateWeapon(index, nextWeapon)
    })
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-textH">
            <Swords className="h-4 w-4 text-accent" />
            Armas
          </div>
          <div className="mt-1 text-xs text-textMuted">
            Equipamentos empunhados e seus recursos ativos.
          </div>
        </div>
        <div className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-text">
          {usedHands}/{totalHands} mãos
        </div>
      </div>

      {weapons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
          Nenhuma arma equipada.
        </div>
      ) : (
        <div className="grid gap-3">
          {weapons.map((weapon, index) => {
            const modifierAttribute = weapon.modifierAttribute ?? "str"
            const attackBonus = weaponAttackBonus(character, weapon)
            const damageBonus = weaponDamageBonus(character, weapon)
            const damageText = formatDie(getWeaponDamageDie(weapon))
            const handUsage = getWeaponHandsUsed(weapon)
            const versatile = isVersatileWeapon(weapon)
            const canUseTwoHands =
              usedHands - handUsage + 2 <= totalHands

            return (
              <article
                key={`${weapon.id}-${index}`}
                className="overflow-hidden rounded-xl border border-border bg-bg-subtle shadow-theme-sm"
              >
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-textH">
                        {weapon.name || "Arma sem nome"}
                      </h3>
                      <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {weapon.proficient ? "Proficiente" : "Não proficiente"}
                      </span>
                      <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-semibold text-textMuted">
                        {versatile
                          ? `Versátil · ${handUsage} ${handUsage === 1 ? "mão" : "mãos"}`
                          : handUsage === 2
                            ? "Duas mãos"
                            : "Uma mão"}
                      </span>
                    </div>

                    {weapon.desc?.trim() ? (
                      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-xs leading-5 text-textMuted">
                        {weapon.desc}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {versatile ? (
                      <div className="flex rounded-lg border border-border bg-bg p-0.5">
                        <button
                          type="button"
                          className={
                            !weapon.wieldedTwoHanded
                              ? "rounded-md bg-accentBg px-2.5 py-1.5 text-xs font-semibold text-textH"
                              : "rounded-md px-2.5 py-1.5 text-xs text-textMuted"
                          }
                          onClick={() => setWeaponGrip(index, false)}
                        >
                          Uma mão
                        </button>
                        <button
                          type="button"
                          disabled={!canUseTwoHands}
                          title={
                            canUseTwoHands
                              ? "Empunhar com duas mãos"
                              : "Não há uma mão livre"
                          }
                          className={
                            weapon.wieldedTwoHanded
                              ? "rounded-md bg-accentBg px-2.5 py-1.5 text-xs font-semibold text-textH"
                              : "rounded-md px-2.5 py-1.5 text-xs text-textMuted disabled:cursor-not-allowed disabled:opacity-40"
                          }
                          onClick={() => setWeaponGrip(index, true)}
                        >
                          Duas mãos
                        </button>
                      </div>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unequipWeapon(index)}
                    >
                      Desequipar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
                  <WeaponStat
                    icon={<Crosshair className="h-4 w-4" />}
                    label="Ataque"
                    value={formatSigned(attackBonus)}
                  />
                  <WeaponStat
                    icon={<Swords className="h-4 w-4" />}
                    label="Dano"
                    value={`${damageText}${damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""}`}
                  />
                  <WeaponStat
                    icon={<Sparkles className="h-4 w-4" />}
                    label="Atributo"
                    value={attributeShort(modifierAttribute)}
                  />
                  <WeaponStat
                    icon={handUsage === 2 ? <Hand className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                    label="Peso"
                    value={String(weapon.weight ?? 0)}
                  />
                </div>

                <div className="p-4">
                  {weapon.properties?.length ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">
                        Propriedades
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {weapon.properties.map((property) => (
                          <span
                            key={property.id}
                            title={property.desc}
                            className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-text"
                          >
                            {property.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <WeaponBonusList weapon={weapon} />

                  <EquipmentFeaturesList
                    equipment={weapon}
                    onUpdate={(updater) =>
                      updateCharacter(character.get("id"), (c) => {
                        const equipment = c.get("equipment")
                        const currentWeapons = [...equipment.weapons]
                        currentWeapons[index] = updater(currentWeapons[index])
                        return c.with("equipment", {
                          ...equipment,
                          weapons: currentWeapons,
                        })
                      })
                    }
                  />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}'''
text = replace_regex(
    text,
    r'export function EquipmentWeaponsSection\(\{.*?\n\}\n\n(?=function WeaponStat)',
    weapons_component + "\n\n",
    "equipment weapons component",
    re.S,
)
write(path, text)


# ---------------------------------------------------------------------------
# Character sheet and compact sheet use the active versatile die.
# ---------------------------------------------------------------------------
path = "src/features/characters/characterSheet/attributeCalculators.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Weapon } from "../../../models/items/equipment/Weapon"',
    'import {\n  getWeaponDamageDie,\n  type Weapon,\n} from "../../../models/items/equipment/Weapon"',
    "attribute calculator weapon helper import",
)
text = replace_once(
    text,
    "  const die = weapon.damage\n",
    "  const die = getWeaponDamageDie(weapon) ?? weapon.damage\n",
    "attribute calculator active die",
)
write(path, text)

path = "src/features/characters/characterSheet/minimalCharacterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Weapon } from "../../../models/items/equipment/Weapon"',
    'import {\n  getWeaponDamageDie,\n  type Weapon,\n} from "../../../models/items/equipment/Weapon"',
    "minimal sheet weapon helper import",
)
text = replace_once(
    text,
    '  const damage = `${weapon.damage.quantity}${weapon.damage.sides}${\n    damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""\n  }`',
    '  const die = getWeaponDamageDie(weapon) ?? weapon.damage\n  const damage = `${die.quantity}${die.sides}${\n    damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""\n  }`',
    "minimal sheet active die",
)
write(path, text)


# ---------------------------------------------------------------------------
# Pocket summary recognises versatile damage and stored grip.
# ---------------------------------------------------------------------------
path = "src/features/characters/equipment/EquipmentPocketSection.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Weapon } from "../../../models/items/equipment/Weapon"',
    'import {\n  getWeaponDamageDie,\n  getWeaponHandsUsed,\n  isVersatileWeapon,\n  type Weapon,\n} from "../../../models/items/equipment/Weapon"',
    "pocket weapon helper import",
)
text = replace_once(
    text,
    '  const damageBonus = character.getEffectiveWeaponDamageBonus(\n    weapon,\n    attributeMod,\n  )\n\n  return (',
    '  const damageBonus = character.getEffectiveWeaponDamageBonus(\n    weapon,\n    attributeMod,\n  )\n  const activeDamage = getWeaponDamageDie(weapon) ?? weapon.damage\n  const versatile = isVersatileWeapon(weapon)\n  const handUsage = getWeaponHandsUsed(weapon)\n\n  return (',
    "pocket active damage variables",
)
text = replace_once(
    text,
    '        Dano base: {formatDie(weapon.damage)}\n        {" • "}',
    '        Dano base: {formatDie(weapon.damage)}\n        {versatile && weapon.versatileDamage\n          ? ` / ${formatDie(weapon.versatileDamage)} (versátil)`\n          : ""}\n        {" • "}',
    "pocket versatile base damage",
)
text = replace_once(
    text,
    '        Dano: {formatDie(weapon.damage)}',
    '        Dano: {formatDie(activeDamage)}',
    "pocket active damage display",
)
text = replace_once(
    text,
    '        {weapon.twoHanded ? "Duas mãos" : "Uma mão"}',
    '        {versatile\n          ? `Versátil · ${handUsage} ${handUsage === 1 ? "mão" : "mãos"}`\n          : handUsage === 2\n            ? "Duas mãos"\n            : "Uma mão"}',
    "pocket grip display",
)
write(path, text)


checks = {
    "src/features/characters/inventory/equipmentFields.tsx": [
        "Bônus próprio de ataque",
        "Dano com duas mãos",
        "WEAPON_PROPERTIES.versatile",
    ],
    "src/models/characters/characterEquipment.ts": [
        "getWeaponHandsUsed",
        "wieldedTwoHanded",
    ],
    "src/models/characters/characterEquipmentInteractions.ts": [
        "getWeaponHandsUsed",
        "versatileDamage",
    ],
    "src/features/characters/equipment/EquipmentWeaponsSection.tsx": [
        "setWeaponGrip",
        "getWeaponDamageDie",
    ],
    "src/features/characters/characterSheet/attributeCalculators.tsx": [
        "getWeaponDamageDie",
    ],
    "src/features/characters/characterSheet/minimalCharacterSheet.tsx": [
        "getWeaponDamageDie",
    ],
}

for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
