import { useState } from "react"
import { Sparkles, Trash2 } from "lucide-react"
import { Button } from "../../../components/ui/Button"
import { abilityRequiresActivation } from "../../../models/abilities/abilityActivation"
import { getActiveAttackRiderEntries, type ActiveAttackRiderEntry } from "../../../models/combat/AttackRider"
import { damageTypeLabel } from "../../../models/combat/Damage"
import { removeCharacterCondition } from "../../../models/characters/characterConditionStorage"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Weapon } from "../../../models/items/equipment/Weapon"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"

type Props = {
  character: CharacterTemplate
  weapon: Weapon
  targetEntryId?: string
  canEditEquipment: boolean
  updateCharacter: (id: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void
}

function effectOrigin(entry: ActiveAttackRiderEntry, character: CharacterTemplate): string {
  const source = entry.origin
  if (source.type === "condition") {
    const ability = source.sourceAbilityId
      ? character.getCharacterAbilities().find(value =>
        value.id === source.sourceAbilityId || value.originalAbilityId === source.sourceAbilityId)
      : undefined
    return ability ? `Condição: ${source.label} · Habilidade: ${ability.name}` : `Condição: ${source.label}`
  }
  if (source.type === "equipment") return `Item: ${source.label}`
  if (source.type === "equipment-ability") return `Habilidade do item: ${source.label}`
  return `Habilidade: ${source.label}`
}

function effectDescription(entry: ActiveAttackRiderEntry): string[] {
  const rider = entry.rider
  return [
    ...(rider.damage ? [`${rider.damage.dice} ${rider.damage.damageType ? damageTypeLabel(rider.damage.damageType) : "do tipo da arma"} por acerto`] : []),
    ...(rider.treatWeaponAsMagical || rider.damage?.magical ? ["Dano mágico"] : []),
    ...(rider.damage?.ignoreResistance ? ["Ignora resistências"] : []),
    ...(rider.replaceWeaponDamageType ? [`Tipo da arma: ${damageTypeLabel(rider.replaceWeaponDamageType)}`] : []),
    ...(rider.weaponAttackAttribute ? ["Modifica atributo da arma"] : []),
    ...(rider.targetEntryId ? ["Somente contra o alvo marcado"] : []),
  ]
}

export function WeaponAppliedEffects({
  character, weapon, targetEntryId, canEditEquipment, updateCharacter,
}: Props) {
  const runtime = useOptionalSessionRuntime()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Show both the effective sources and any old duplicates that the roller
  // suppresses, so users can identify and remove a stuck condition.
  const entries = getActiveAttackRiderEntries(
    character,
    { scope: "weapon", weaponId: weapon.id, targetEntryId },
    { includeDuplicates: true, includeOtherTargets: true },
  )

  function canRemove(entry: ActiveAttackRiderEntry): boolean {
    const source = entry.origin
    if (source.type === "condition") return true
    if (source.type === "equipment") return canEditEquipment && source.itemId === weapon.id
    if (source.type === "equipment-ability") {
      const ability = character.getEquipmentAbilities().find(value =>
        value.sourceItemId === source.itemId && value.originalAbilityId === source.abilityId)
      return Boolean(ability && abilityRequiresActivation(ability))
    }
    const ability = (character.get("abilities") ?? []).find(value => value.id === source.abilityId)
    return Boolean(ability && abilityRequiresActivation(ability))
  }

  function remove(entry: ActiveAttackRiderEntry) {
    const source = entry.origin
    const key = `${source.type}:${entry.rider.id}:${source.type === "condition" ? source.conditionId : ""}`
    if (runtime && runtime.status !== "connected") {
      setError("Aguarde a conexão com a sessão para remover o efeito.")
      return
    }
    setError(null)
    setPendingId(key)
    let dispatched = true
    if (source.type === "condition") {
      if (runtime) {
        dispatched = runtime.dispatchAbilityOperation({
          type: "character.ability.effect.remove",
          characterId: character.get("id"),
          conditionId: source.conditionId,
        })
      } else {
        updateCharacter(character.get("id"), current => removeCharacterCondition(current, source.conditionId))
      }
    } else if (source.type === "equipment" && source.itemId === weapon.id && canEditEquipment) {
      updateCharacter(character.get("id"), current => {
        const equipment = current.get("equipment")
        return current.with("equipment", {
          ...equipment,
          weapons: equipment.weapons.map(item => item.id !== weapon.id ? item : {
            ...item,
            bonuses: {
              ...(item.bonuses ?? {}),
              attackRiders: (item.bonuses?.attackRiders ?? []).filter(rider => rider.id !== entry.rider.id),
            },
          }),
        })
      })
    } else if (source.type === "ability") {
      if (runtime) {
        dispatched = runtime.dispatchAbilityOperation({
          type: "character.ability.deactivate",
          characterId: character.get("id"),
          source: { type: "character", abilityId: source.abilityId },
        })
      } else updateCharacter(character.get("id"), current => current.deactivateAbility(source.abilityId))
    } else if (source.type === "equipment-ability") {
      if (runtime) {
        dispatched = runtime.dispatchAbilityOperation({
          type: "character.ability.deactivate",
          characterId: character.get("id"),
          source: { type: "equipment", abilityId: source.abilityId, itemId: source.itemId },
        })
      } else updateCharacter(character.get("id"), current => current.deactivateEquipmentAbility(source.itemId, source.abilityId))
    }
    if (!dispatched) setError("Não foi possível enviar a remoção. Tente novamente.")
    setPendingId(null)
  }

  if (!entries.length) return null

  return (
    <section className="mb-4 rounded-xl border border-accentBorder bg-bg-elevated p-3" aria-label={`Efeitos ativos em ${weapon.name}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-textH">
          <Sparkles className="h-4 w-4 text-accent" />
          Efeitos aplicados nesta arma
          <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px]">{entries.length}</span>
        </div>
        <span className="text-[10px] text-textMuted">Origem e dano adicional</span>
      </div>
      <div className="grid gap-2">
        {entries.map((entry, index) => {
          const source = entry.origin
          const removable = canRemove(entry)
          const key = `${source.type}:${entry.rider.id}:${source.type === "condition" ? source.conditionId : ""}`
          const description = effectDescription(entry)
          return (
            <div key={`${key}:${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-textH">
                  <span>{entry.rider.label || "Efeito de ataque"}</span>
                  {entry.suppressedDuplicate ? (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-textMuted">
                      Duplicado · não é rolado
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-textMuted">{effectOrigin(entry, character)}</div>
                {description.length ? <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-text">
                  {description.map(text => <span key={text} className="rounded bg-bg-subtle px-1.5 py-0.5">{text}</span>)}
                </div> : null}
              </div>
              {removable ? <Button
                size="sm"
                variant="ghost"
                disabled={pendingId === key || Boolean(runtime && runtime.status !== "connected")}
                onClick={() => remove(entry)}
                title="Remover este efeito e sua origem ativa, sem apagar a habilidade do personagem"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
              </Button> : <span className="shrink-0 text-[10px] text-textMuted">Na origem</span>}
            </div>
          )
        })}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
    </section>
  )
}
