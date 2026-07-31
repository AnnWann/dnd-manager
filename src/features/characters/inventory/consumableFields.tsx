import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type {
  ConsumableEffect,
  ConsumableItem,
} from "../../../models/items/equipment/PocketItem"
import type { Itemmable } from "../../../models/items/item"
import { BonusesFields } from "./equipmentBonusFields"
import {
  GrantedSpellsEditor,
  type EditableSpellGrant,
} from "../magic/grantedSpellsEditor"

export function ConsumableFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const consumable = isConsumableItem(item) ? item : undefined
  const effect = consumable?.consumptionEffect

  function updateEffect(
    updater: (effect: ConsumableEffect) => ConsumableEffect,
  ) {
    onUpdate((current) => {
      const currentConsumable = current as Partial<ConsumableItem>
      const currentEffect =
        currentConsumable.consumptionEffect ?? createDefaultEffect(current)

      return {
        ...current,
        consumptionEffect: updater(currentEffect),
      }
    })
  }

  return (
    <div className="grid gap-3 md:col-span-3">
      <label className="grid gap-2">
        <span className="text-xs text-text">Uso</span>
        <Input
          value={consumable?.useText ?? ""}
          onChange={(event) =>
            onUpdate((current) => ({
              ...current,
              useText: event.target.value,
            }))
          }
          placeholder="Ex.: Recupera 2d4+2 PV"
        />
      </label>

      <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-textH">
              Efeito concedido ao consumir
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-textMuted">
              Concede bônus e magias ao personagem depois que uma unidade for usada.
            </p>
          </div>

          {effect ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onUpdate((current) => ({
                  ...current,
                  consumptionEffect: undefined,
                }))
              }
            >
              Remover efeito
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                onUpdate((current) => ({
                  ...current,
                  consumptionEffect: createDefaultEffect(current),
                }))
              }
            >
              + Configurar efeito
            </Button>
          )}
        </div>

        {effect ? (
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">
                  Nome do efeito
                </span>
                <Input
                  value={effect.name ?? ""}
                  placeholder={`Efeito de ${item.name || "consumível"}`}
                  onChange={(event) =>
                    updateEffect((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">
                  Permanência
                </span>
                <Select
                  value={effect.persistence}
                  onChange={(event) =>
                    updateEffect((current) => ({
                      ...current,
                      persistence: event.target.value as ConsumableEffect["persistence"],
                    }))
                  }
                >
                  <option value="temporary">Temporário</option>
                  <option value="permanent">Permanente</option>
                </Select>
              </label>
            </div>

            {effect.persistence === "temporary" ? (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">
                  Duração descrita
                </span>
                <Input
                  value={effect.durationText ?? ""}
                  placeholder="Ex.: 1 hora, até o próximo descanso ou até ser dissipado"
                  onChange={(event) =>
                    updateEffect((current) => ({
                      ...current,
                      durationText: event.target.value,
                    }))
                  }
                />
                <span className="text-[10px] text-textMuted">
                  O efeito será registrado como uma condição removível do personagem.
                </span>
              </label>
            ) : (
              <div className="rounded-lg bg-accentBg px-3 py-2 text-[11px] leading-4 text-textH">
                O efeito será salvo como uma característica permanente. Consumir novamente o mesmo efeito atualiza a característica em vez de duplicá-la.
              </div>
            )}

            <BonusesFields
              bonuses={effect.bonuses ?? {}}
              description={
                effect.persistence === "temporary"
                  ? "Bônus ativos enquanto a condição do consumível existir."
                  : "Bônus incorporados permanentemente ao personagem."
              }
              onChange={(bonuses) =>
                updateEffect((current) => ({ ...current, bonuses }))
              }
            />

            <GrantedSpellsEditor
              variant="ability"
              grants={(effect.grantedSpells ?? []) as EditableSpellGrant[]}
              abilityHasUsage={false}
              onChange={(grantedSpells) =>
                updateEffect((current) => ({ ...current, grantedSpells }))
              }
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-xs text-textMuted">
            O consumível apenas reduz sua quantidade enquanto nenhum efeito estiver configurado.
          </div>
        )}
      </section>
    </div>
  )
}

export function withConsumableDefaults(item: Itemmable): ConsumableItem {
  const consumable = item as Partial<ConsumableItem>
  const effect = consumable.consumptionEffect

  return {
    ...item,
    kind: "consumable",
    equippable: false,
    equipSlot: undefined,
    pocketable: true,
    useText: consumable.useText ?? "",
    consumptionEffect: effect
      ? {
          ...effect,
          id: effect.id?.trim() || crypto.randomUUID(),
          persistence:
            effect.persistence === "permanent" ? "permanent" : "temporary",
          bonuses: effect.bonuses ?? {},
          grantedSpells: effect.grantedSpells ?? [],
        }
      : undefined,
  }
}

export function isConsumableItem(item: Itemmable): item is ConsumableItem {
  return item.kind === "consumable"
}

function createDefaultEffect(item: Itemmable): ConsumableEffect {
  return {
    id: crypto.randomUUID(),
    name: item.name?.trim() ? `Efeito de ${item.name.trim()}` : "Efeito do consumível",
    description:
      typeof (item as Partial<ConsumableItem>).useText === "string"
        ? (item as Partial<ConsumableItem>).useText
        : "",
    persistence: "temporary",
    durationText: "Até o efeito ser encerrado",
    bonuses: {},
    grantedSpells: [],
  }
}
