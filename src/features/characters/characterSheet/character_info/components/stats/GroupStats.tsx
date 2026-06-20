import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
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
  const proficiency = character.getProficiencyBonus()

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <StatShell label="Classe de Armadura">
        <SelectStatModule
          name="CA"
          statKey="armorClass"
          getValue={(current) => current.getEffectiveArmorClass()}
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
          getValue={(current) =>
            current.getEffectivePassivePerception()
          }
          character={character}
          updateCharacter={updateCharacter}
          fallback={10}
        />
      </StatShell>

      <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-accentBorder bg-accentBg p-3 text-center shadow-theme-sm">
        <div className="text-2xl font-bold text-textH">
          +{proficiency}
        </div>

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