import type { ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import { formatBonusName, formatBonusValue } from "../../../lib/formatBonus"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import { EquipmentFeaturesList } from "./equipmentFeaturesList"

type NormalBonusKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "damageBonus"
  | "speed"

const NORMAL_BONUS_KEYS: NormalBonusKey[] = [
  "armorClass",
  "initiative",
  "maxHp",
  "temporaryHp",
  "passivePerception",
  "attackBonus",
  "damageBonus",
  "speed",
]

export type EquipmentDisplayStat = {
  icon: ReactNode
  label: string
  value: string
}

type Props<T extends Equipment> = {
  item: T
  fallbackName: string
  badges?: string[]
  stats?: EquipmentDisplayStat[]
  onUnequip: () => void
  onUpdate: (updater: (item: T) => T) => void
  children?: ReactNode
}

export function EquipmentItemCard<T extends Equipment>({
  item,
  fallbackName,
  badges = [],
  stats = [],
  onUnequip,
  onUpdate,
  children,
}: Props<T>) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-bg-subtle shadow-theme-sm">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-textH">
              {item.name || fallbackName}
            </h3>

            {badges.map((badge, index) => (
              <span
                key={`${badge}-${index}`}
                className={
                  index === 0
                    ? "rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent"
                    : "rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-semibold text-textMuted"
                }
              >
                {badge}
              </span>
            ))}
          </div>

          {item.desc?.trim() ? (
            <p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-xs leading-5 text-textMuted">
              {item.desc}
            </p>
          ) : null}
        </div>

        <Button
          className="w-full shrink-0 sm:w-auto"
          size="sm"
          variant="ghost"
          onClick={onUnequip}
        >
          Desequipar
        </Button>
      </div>

      {stats.length > 0 ? (
        <div
          className={[
            "grid gap-px border-y border-border bg-border",
            stats.length >= 4
              ? "grid-cols-2 sm:grid-cols-4"
              : stats.length === 3
                ? "grid-cols-2 sm:grid-cols-3"
                : "grid-cols-2",
          ].join(" ")}
        >
          {stats.map((stat) => (
            <EquipmentStat
              key={`${stat.label}-${stat.value}`}
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>
      ) : null}

      <div className="p-4">
        {children}
        <EquipmentBonusList bonuses={item.bonuses} />
        <EquipmentFeaturesList equipment={item} onUpdate={onUpdate} />
      </div>
    </article>
  )
}

function EquipmentStat({
  icon,
  label,
  value,
}: EquipmentDisplayStat) {
  return (
    <div className="min-w-0 bg-bg px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        <span className="shrink-0 text-accent">{icon}</span>
        <span className="truncate">{label}</span>
      </div>

      <div className="mt-1 break-words text-base font-bold text-textH">
        {value}
      </div>
    </div>
  )
}

export function EquipmentBonusList({
  bonuses,
}: {
  bonuses: Equipment["bonuses"]
}) {
  if (!bonuses) return null

  const rows: string[] = []

  for (const key of NORMAL_BONUS_KEYS) {
    const values = bonuses[key]
    if (!Array.isArray(values)) continue

    for (const bonus of values) {
      rows.push(`${formatBonusName(key)}: ${formatBonusValue(bonus)}`)
    }
  }

  for (const entry of bonuses.attribute ?? []) {
    rows.push(
      `Atributo ${entry.attribute.toUpperCase()}: ${formatBonusValue(
        entry.bonus,
      )}`,
    )
  }

  for (const entry of bonuses.attributeModifier ?? []) {
    rows.push(
      `Mod. ${entry.attribute.toUpperCase()}: ${formatBonusValue(
        entry.bonus,
      )}`,
    )
  }

  if (bonuses.attack) {
    rows.push(
      `Ataque do item: ${formatBonusValue(bonuses.attack.bonus)}`,
    )
  }

  if (bonuses.damage) {
    rows.push(
      `Dano do item: ${formatBonusValue(bonuses.damage.bonus)}`,
    )
  }

  if (rows.length === 0) return null

  return (
    <div className={childrenNeedsSpacing(bonuses) ? "mt-4" : ""}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">
        Bônus
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row) => (
          <span
            key={row}
            className="rounded-full bg-accentBg px-2.5 py-1 text-xs font-medium text-textH"
          >
            {row}
          </span>
        ))}
      </div>
    </div>
  )
}

function childrenNeedsSpacing(
  _bonuses: Equipment["bonuses"],
): boolean {
  return false
}
