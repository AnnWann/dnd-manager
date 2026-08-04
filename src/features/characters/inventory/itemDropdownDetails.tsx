import { Button } from "../../../components/ui/Button"
import { useMagicContext } from "../../../contexts/magicContext"
import { attributeShort } from "../../../lib/attributeShorts"
import { formatBonusName, formatBonusValue } from "../../../lib/formatBonus"
import type { BonusCollection } from "../../../models/bonuses/Bonus"
import type { Die } from "../../../models/dice/Die"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import type {
  ConsumableItem,
  ThrowableItem,
} from "../../../models/items/equipment/PocketItem"
import type { Weapon } from "../../../models/items/equipment/Weapon"
import type { Itemmable } from "../../../models/items/item"
import type { SupplyItem } from "../../../models/items/SupplyItem"

export function ItemDropdownDetails({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate?: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const { getSpellByIndex } = useMagicContext()
  const equipment = isEquipment(item) ? (item as Equipment) : null
  const weapon = isWeapon(item) ? (item as Weapon) : null
  const consumable = item.kind === "consumable" ? (item as ConsumableItem) : null
  const throwable = item.kind === "throwable" ? (item as ThrowableItem) : null
  const supply = item.kind === "supply" ? (item as SupplyItem) : null

  function updateAbilityCharge(abilityId: string, delta: number) {
    onUpdate?.((current) => {
      const currentEquipment = current as Equipment
      return {
        ...currentEquipment,
        abilities: (currentEquipment.abilities ?? []).map((ability) => {
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
    onUpdate?.((current) => {
      const currentEquipment = current as Equipment
      return {
        ...currentEquipment,
        spells: (currentEquipment.spells ?? []).map((spell) => {
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

  const summaryRows = buildSummaryRows(item, weapon, throwable, supply)

  return (
    <div className="grid gap-5 text-sm text-text">
      {summaryRows.length ? (
        <section>
          <SectionTitle>Propriedades gerais</SectionTitle>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summaryRows.map(([label, value]) => (
              <DetailStat key={label} label={label} value={value} />
            ))}
          </div>
        </section>
      ) : null}

      {weapon ? (
        <section>
          <SectionTitle>Combate</SectionTitle>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <DetailStat label="Dano" value={formatDie(weapon.damage)} />
            {weapon.versatileDamage ? (
              <DetailStat
                label="Dano versátil"
                value={formatDie(weapon.versatileDamage)}
              />
            ) : null}
            <DetailStat
              label="Atributo"
              value={attributeShort(weapon.modifierAttribute)}
            />
            <DetailStat
              label="Proficiência"
              value={weapon.proficient ? "Proficiente" : "Não proficiente"}
            />
            <DetailStat
              label="Empunhadura"
              value={weapon.wieldedTwoHanded ? "Duas mãos" : "Uma mão"}
            />
          </div>

          {weapon.properties?.length ? (
            <div className="mt-4">
              <div className="text-xs font-medium text-textH">Propriedades da arma</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {weapon.properties.map((property) => (
                  <div
                    key={property.id}
                    className="rounded-lg border border-border bg-bg-subtle p-3"
                  >
                    <div className="text-xs font-semibold text-textH">
                      {property.name}
                    </div>
                    {property.desc ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                        {property.desc}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {item.desc ? (
        <section>
          <SectionTitle>Descrição</SectionTitle>
          <p className="mt-2 whitespace-pre-wrap leading-6">{item.desc}</p>
        </section>
      ) : null}

      {item.notes ? (
        <section>
          <SectionTitle>Notas</SectionTitle>
          <p className="mt-2 whitespace-pre-wrap leading-6">{item.notes}</p>
        </section>
      ) : null}

      {equipment?.bonuses ? (
        <BonusDetails bonuses={equipment.bonuses} />
      ) : null}

      {consumable?.useText ? (
        <section>
          <SectionTitle>Uso</SectionTitle>
          <p className="mt-2 whitespace-pre-wrap leading-6">{consumable.useText}</p>
        </section>
      ) : null}

      {consumable?.consumptionEffect ? (
        <section>
          <SectionTitle>Efeito ao consumir</SectionTitle>
          <div className="mt-2 rounded-lg border border-border bg-bg-subtle p-3">
            <div className="font-medium text-textH">
              {consumable.consumptionEffect.name || `Efeito de ${item.name}`}
            </div>
            <div className="mt-1 text-xs text-textMuted">
              {consumable.consumptionEffect.persistence === "permanent"
                ? "Permanente"
                : consumable.consumptionEffect.durationText?.trim() || "Temporário"}
            </div>
            {consumable.consumptionEffect.description?.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5">
                {consumable.consumptionEffect.description}
              </p>
            ) : null}
            {consumable.consumptionEffect.bonuses ? (
              <div className="mt-3">
                <BonusDetails bonuses={consumable.consumptionEffect.bonuses} compact />
              </div>
            ) : null}
            {consumable.consumptionEffect.grantedSpells?.length ? (
              <div className="mt-3">
                <div className="text-xs font-medium text-textH">Magias concedidas</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {consumable.consumptionEffect.grantedSpells.map((grant) => {
                    const spell = getSpellByIndex(grant.index)
                    return (
                      <Badge
                        key={grant.index}
                        label={spell?.displayName || spell?.name || grant.index}
                      />
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {equipment?.abilities?.length ? (
        <section>
          <SectionTitle>Habilidades concedidas</SectionTitle>
          <div className="mt-2 grid gap-2">
            {equipment.abilities.map((ability) => {
              const usage = ability.usage
              const canConsume = Boolean(
                onUpdate && usage && usage.reset !== "spellSlot",
              )
              const canRestore = Boolean(
                onUpdate &&
                  usage &&
                  usage.reset !== "spellSlot" &&
                  usage.reset !== "limited",
              )

              return (
                <div
                  key={ability.id}
                  className="rounded-lg border border-border bg-bg-subtle p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-textH">
                        {ability.name || "Habilidade sem nome"}
                      </div>
                      {usage ? (
                        <div className="mt-1 text-xs text-textMuted">
                          {usage.reset === "spellSlot"
                            ? "Usa espaço de magia"
                            : `${Math.max(0, usage.max - usage.used)}/${usage.max} cargas · recarga: ${formatReset(usage.reset)}`}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-textMuted">Sem limite de uso</div>
                      )}
                    </div>
                    {usage && (canConsume || canRestore) ? (
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
                    <p className="mt-3 whitespace-pre-wrap text-xs leading-5">
                      {ability.description}
                    </p>
                  ) : null}
                  {ability.grantedSpells?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ability.grantedSpells.map((grant) => {
                        const spell = getSpellByIndex(grant.index)
                        return (
                          <Badge
                            key={grant.index}
                            label={spell?.displayName || spell?.name || grant.index}
                          />
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {equipment?.spells?.length ? (
        <section>
          <SectionTitle>Magias concedidas</SectionTitle>
          <div className="mt-2 grid gap-2">
            {equipment.spells.map((grant, index) => {
              const spell = getSpellByIndex(grant.index)
              const usage = grant.usage
              const canConsume = usage.reset !== "spellSlot"
              const canRestore =
                usage.reset !== "spellSlot" && usage.reset !== "limited"
              return (
                <div
                  key={`${grant.index}-${index}`}
                  className="rounded-lg border border-border bg-bg-subtle p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-textH">
                        {spell?.displayName || spell?.name || grant.index}
                      </div>
                      <div className="mt-1 text-xs text-textMuted">
                        {usage.reset === "spellSlot"
                          ? "Usa espaços de magia normais"
                          : `${Math.max(0, usage.max - usage.used)}/${usage.max} cargas · recarga: ${formatReset(usage.reset)}`}
                      </div>
                    </div>
                    {onUpdate && (canConsume || canRestore) ? (
                      <div className="flex gap-2">
                        {canConsume ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={usage.used >= usage.max}
                            onClick={() => updateSpellCharge(grant.index, 1)}
                          >
                            Consumir
                          </Button>
                        ) : null}
                        {canRestore ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={usage.used <= 0}
                            onClick={() => updateSpellCharge(grant.index, -1)}
                          >
                            Regenerar
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function buildSummaryRows(
  item: Itemmable,
  weapon: Weapon | null,
  throwable: ThrowableItem | null,
  supply: SupplyItem | null,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Tipo", formatKind(item)],
    ["Quantidade", String(item.quantity ?? 1)],
    ["Peso por item", `${item.weight ?? 0} kg`],
    ["Peso total", `${(item.weight ?? 0) * (item.quantity ?? 1)} kg`],
  ]

  if (item.magicItem) rows.push(["Item mágico", "Sim"])
  if (item.requiresAttunement) {
    rows.push(["Sintonia", item.attuned ? "Sintonizado" : "Necessária"])
  }
  if (item.equipSlot) rows.push(["Slot", formatEquipSlot(item.equipSlot)])
  if (item.insideBagOfHolding) rows.push(["Local", "Bolsa Mágica"])
  if (item.heldHands) rows.push(["Mãos ocupadas", String(item.heldHands)])
  if (throwable?.range) rows.push(["Alcance", throwable.range])
  if (throwable?.damage) rows.push(["Dano", formatDie(throwable.damage)])
  if (supply) {
    const units = supply.supplyUnitsPerItem ?? 0
    const label = supply.supplyUnitLabel?.trim() || "unidades"
    rows.push(["Suprimento", `${units} ${label} por item`])
  }
  if (weapon && (weapon as Weapon & { range?: string }).range) {
    rows.push(["Alcance", String((weapon as Weapon & { range?: string }).range)])
  }

  return rows
}

function BonusDetails({
  bonuses,
  compact = false,
}: {
  bonuses: BonusCollection
  compact?: boolean
}) {
  const rows: string[] = []
  for (const [key, rawValue] of Object.entries(bonuses)) {
    if (!rawValue) continue
    if (Array.isArray(rawValue)) {
      for (const entry of rawValue) {
        if (entry && typeof entry === "object" && "bonus" in entry) {
          const typed = entry as { bonus: unknown; attribute?: string }
          rows.push(
            `${formatBonusName(key)}${typed.attribute ? ` ${attributeShort(typed.attribute as never)}` : ""}: ${formatBonusValue(typed.bonus as never)}`,
          )
        } else {
          rows.push(`${formatBonusName(key)}: ${formatBonusValue(entry as never)}`)
        }
      }
    } else if (typeof rawValue === "object" && "bonus" in rawValue) {
      rows.push(
        `${formatBonusName(key)}: ${formatBonusValue((rawValue as { bonus: never }).bonus)}`,
      )
    }
  }

  if (!rows.length) return null
  return (
    <section>
      {!compact ? <SectionTitle>Bônus concedidos</SectionTitle> : null}
      <div className={compact ? "flex flex-wrap gap-2" : "mt-2 flex flex-wrap gap-2"}>
        {rows.map((row, index) => (
          <Badge key={`${row}-${index}`} label={row} />
        ))}
      </div>
    </section>
  )
}

function isEquipment(item: Itemmable): boolean {
  return item.kind === "equipment" || item.kind === "shield"
}

function isWeapon(item: Itemmable): boolean {
  return item.kind === "equipment" && item.equipSlot === "weapon"
}

function formatDie(die: Die | undefined): string {
  return die ? `${die.quantity}${die.sides}` : "—"
}

function formatKind(item: Itemmable): string {
  if (item.category === "bagOfHolding") return "Bolsa Mágica"
  const labels: Record<string, string> = {
    common: "Comum",
    equipment: "Equipamento",
    consumable: "Consumível",
    throwable: "Arremessável",
    supply: "Suprimento",
    ammunition: "Munição",
    tool: "Ferramenta",
    focus: "Foco",
    instrument: "Instrumento",
    pack: "Pacote",
    gear: "Equipamento geral",
    currency: "Moeda",
    shield: "Escudo",
  }
  return labels[item.kind] ?? item.kind
}

function formatEquipSlot(slot: string): string {
  const labels: Record<string, string> = {
    armor: "Armadura",
    helmet: "Capacete",
    gloves: "Luvas",
    boots: "Botas",
    cape: "Capa",
    shield: "Escudo",
    weapon: "Arma",
    ring: "Anel",
    necklace: "Colar",
  }
  return labels[slot] ?? slot
}

function formatReset(reset: string): string {
  const labels: Record<string, string> = {
    shortRest: "descanso curto",
    longRest: "descanso longo",
    dawn: "amanhecer",
    limited: "limitada",
    spellSlot: "espaço de magia",
  }
  return labels[reset] ?? reset
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-textH">
      {children}
    </div>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-textH">{value}</div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-xs text-textH">
      {label}
    </span>
  )
}
