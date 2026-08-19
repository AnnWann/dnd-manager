import { Sparkles } from "lucide-react"

import { Input } from "../../../../../../components/ui/Input"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import {
  getCalculatedArmorClassWithShield,
  getEffectiveArmorClassWithShield,
} from "../../../../../../models/items/equipment/Shield"
import { useCharacterWorkspace } from "../../../../workspace/CharacterWorkspaceContext"
import { SelectStatModule } from "./selectStatModule"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function GroupStats({
  character,
  updateCharacter,
}: Props) {
  const { dispatchStatOperation } = useCharacterWorkspace()
  const proficiency = character.getProficiencyBonus()
  const exhaustion = character.get("sheet").stats.exhaustion ?? 0
  const inspiration = character.get("sheet").stats.inspiration ?? false
  const characterId = character.get("id")

  function setExhaustion(value: number) {
    const nextExhaustion = Math.max(0, Math.min(6, Math.trunc(value) || 0))
    if (dispatchStatOperation({
      type: "character.stat.exhaustion.set",
      characterId,
      value: nextExhaustion,
    })) return

    updateCharacter(characterId, (current) =>
      current.withStat("exhaustion", nextExhaustion),
    )
  }

  function setInspiration(value: boolean) {
    if (dispatchStatOperation({
      type: "character.stat.inspiration.set",
      characterId,
      value,
    })) return

    updateCharacter(characterId, (current) =>
      current.withStat("inspiration", value),
    )
  }

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
      <StatShell label="Classe de Armadura">
        <SelectStatModule
          name="CA"
          statKey="armorClass"
          getValue={getEffectiveArmorClassWithShield}
          getCalculatedValue={getCalculatedArmorClassWithShield}
          character={character}
          updateCharacter={updateCharacter}
          fallback={10}
        />
      </StatShell>

      <StatShell label="Iniciativa">
        <SelectStatModule
          name="Iniciativa"
          statKey="initiative"
          getValue={(current) => current.getEffectiveInitiative()}
          character={character}
          updateCharacter={updateCharacter}
          fallback={0}
        />
      </StatShell>

      <StatShell label="Deslocamento">
        <SelectStatModule
          name="Mobilidade"
          statKey="mobility"
          getValue={(current) => current.getEffectiveMobility()}
          character={character}
          updateCharacter={updateCharacter}
          fallback={9}
        />
      </StatShell>

      <StatShell label="Percepção passiva">
        <SelectStatModule
          name="Percepção"
          statKey="passive_perception"
          getValue={(current) => current.getEffectivePassivePerception()}
          character={character}
          updateCharacter={updateCharacter}
          fallback={10}
        />
      </StatShell>

      <StatShell label="Exaustão">
        <label className="text-xs text-text">
          Nível
          <Input
            type="number"
            min={0}
            max={6}
            className="mt-1 text-center"
            value={exhaustion}
            onChange={(event) => setExhaustion(Number(event.target.value))}
          />
        </label>
      </StatShell>

      <StatShell label="Inspiração">
        <button
          type="button"
          aria-pressed={inspiration}
          onClick={() => setInspiration(!inspiration)}
          className={
            inspiration
              ? "flex w-full flex-col items-center justify-center rounded-lg border border-accentBorder bg-accentBg px-2 py-2 text-center text-textH transition-colors"
              : "flex w-full flex-col items-center justify-center rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center text-textMuted transition-colors hover:bg-bg"
          }
        >
          <Sparkles
            className={
              inspiration
                ? "h-5 w-5 text-accent"
                : "h-5 w-5 text-textMuted"
            }
          />
          <span className="mt-1 text-xs font-semibold">
            {inspiration ? "Disponível" : "Gasta"}
          </span>
        </button>
      </StatShell>

      <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-accentBorder bg-accentBg p-3 text-center shadow-theme-sm">
        <div className="text-2xl font-bold text-textH">+{proficiency}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-textMuted">
          Proficiência
        </div>
      </div>
    </section>
  )
}

function StatShell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-24 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <div className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-textMuted">
        {label}
      </div>
      {children}
    </div>
  )
}
