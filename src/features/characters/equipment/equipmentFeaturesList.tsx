import { Button } from "../../../components/ui/Button"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  abilityRequiresActivation,
  getAbilityUsageMax,
  isAbilityBenefitsActive,
} from "../../../models/abilities/abilityActivation"
import type { AbilityUsageResetKind } from "../../../models/abilities/Ability"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"

type Props<T extends Equipment> = {
  characterId: string
  equipment: T
  onUpdate: (updater: (equipment: T) => T) => void
}

export function EquipmentFeaturesList<T extends Equipment>({
  characterId,
  equipment,
  onUpdate,
}: Props<T>) {
  const { getSpellByIndex } = useMagicContext()
  const { characters, updateCharacter, mode } = useCharacterWorkspace()
  const character = characters.find((entry) => entry.get("id") === characterId)
  const userMode = mode === "user"
  const abilities = equipment.abilities ?? []
  const spells = equipment.spells ?? []

  if (!abilities.length && !spells.length) return null

  function updateAbilityState(
    abilityId: string,
    action: "use" | "restore" | "deactivate",
  ) {
    if (!character || userMode) return

    updateCharacter(characterId, (current) => {
      if (action === "use") {
        return current.useEquipmentAbility(equipment.id, abilityId)
      }
      if (action === "deactivate") {
        return current.deactivateEquipmentAbility(equipment.id, abilityId)
      }
      return current.restoreEquipmentAbility(equipment.id, abilityId)
    })
  }

  function updateSpellCharge(spellIndex: string, delta: number) {
    if (userMode) return

    onUpdate((current) => ({
      ...current,
      spells: (current.spells ?? []).map((spell) => {
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
    }))
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-textH">
            Recursos do item
          </div>
          <div className="mt-0.5 text-[11px] text-textMuted">
            {userMode
              ? "Habilidades e magias concedidas enquanto o item estiver equipado."
              : "Habilidades e magias concedidas enquanto o item estiver equipado."}
          </div>
        </div>

        <div className="rounded-full border border-border bg-bg px-2 py-1 text-[10px] font-semibold text-textMuted">
          {abilities.length + spells.length} recurso
          {abilities.length + spells.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {abilities.map((ability) => {
          const usage = ability.usage
          const usageMax = usage
            ? character
              ? getAbilityUsageMax(character, usage)
              : usage.max
            : undefined
          const remaining = usage && usageMax !== undefined
            ? Math.max(0, usageMax - usage.used)
            : undefined
          const requiresActivation = abilityRequiresActivation(ability)
          const benefitsActive = isAbilityBenefitsActive(ability)
          const canTrigger = requiresActivation && !benefitsActive
          const canRestore =
            usage &&
            usage.reset !== "spellSlot" &&
            usage.reset !== "limited"

          return (
            <div
              key={ability.id}
              className="rounded-lg bg-bg px-3 py-3 shadow-theme-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-textH">
                      {ability.name || "Habilidade sem nome"}
                    </div>
                    <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                      Habilidade
                    </span>
                  </div>

                  {usage ? (
                    <div className="mt-1 text-xs font-medium text-text">
                      {userMode
                        ? formatUsageDefinition(usageMax ?? usage.max, usage.reset)
                        : usage.reset === "spellSlot"
                          ? "Usa espaço de magia"
                          : `${remaining}/${usageMax} cargas disponíveis`}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-textMuted">
                      Sem limite de uso
                    </div>
                  )}

                  {ability.grantedSpells?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ability.grantedSpells.map((grant) => {
                        const grantedSpell = getSpellByIndex(grant.index)
                        return (
                          <span
                            key={grant.index}
                            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-textMuted"
                          >
                            {grantedSpell?.displayName ||
                              grantedSpell?.name ||
                              grant.index}
                            {grant.castingMode === "known"
                              ? " • slots"
                              : " • habilidade"}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                {!userMode ? (
                  <div className="flex shrink-0 gap-2">
                    {canTrigger ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={remaining !== undefined && remaining <= 0}
                        onClick={() => updateAbilityState(ability.id, "use")}
                      >
                        {(ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}
                      </Button>
                    ) : null}

                    {requiresActivation && benefitsActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateAbilityState(ability.id, "deactivate")}
                      >
                        Encerrar
                      </Button>
                    ) : null}

                    {canRestore ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={usage.used <= 0}
                        onClick={() => updateAbilityState(ability.id, "restore")}
                      >
                        Regenerar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {ability.description ? (
                <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                  {ability.description}
                </div>
              ) : null}
            </div>
          )
        })}

        {spells.map((spellGrant, index) => {
          const spell = getSpellByIndex(spellGrant.index)
          const canConsume = spellGrant.usage.reset !== "spellSlot"
          const canRestore =
            spellGrant.usage.reset !== "spellSlot" &&
            spellGrant.usage.reset !== "limited"
          const remaining = Math.max(
            0,
            spellGrant.usage.max - spellGrant.usage.used,
          )

          return (
            <div
              key={`${spellGrant.index}-${index}`}
              className="rounded-lg bg-bg px-3 py-3 shadow-theme-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold text-textH">
                      {spell?.displayName ||
                        spell?.name ||
                        spellGrant.index ||
                        "Magia sem nome"}
                    </div>
                    <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                      Magia
                    </span>
                  </div>

                  <div className="mt-1 text-xs font-medium text-text">
                    {userMode
                      ? spellGrant.usage.reset === "spellSlot"
                        ? "Aprendida pelo item • usa espaços normais"
                        : formatUsageDefinition(
                            spellGrant.usage.max,
                            spellGrant.usage.reset,
                          )
                      : spellGrant.usage.reset === "spellSlot"
                        ? "Aprendida pelo item • usa espaços normais"
                        : `${remaining}/${spellGrant.usage.max} cargas do item`}
                  </div>
                </div>

                {!userMode ? (
                  <div className="flex shrink-0 gap-2">
                    {canConsume ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          spellGrant.usage.used >= spellGrant.usage.max
                        }
                        onClick={() =>
                          updateSpellCharge(spellGrant.index, 1)
                        }
                      >
                        Consumir
                      </Button>
                    ) : null}

                    {canRestore ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={spellGrant.usage.used <= 0}
                        onClick={() =>
                          updateSpellCharge(spellGrant.index, -1)
                        }
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
    </div>
  )
}

function formatUsageDefinition(
  maximum: number,
  reset: AbilityUsageResetKind,
): string {
  if (reset === "spellSlot") return "Usa espaço de magia"

  const uses = `${maximum} ${maximum === 1 ? "uso" : "usos"}`
  if (reset === "shortRest") return `${uses} • descanso curto`
  if (reset === "longRest") return `${uses} • descanso longo`
  if (reset === "turn") return `${uses} • por turno`
  if (reset === "cooldown") return `${uses} • recarga`
  if (reset === "limited") return `${uses} • limite permanente`
  return uses
}
