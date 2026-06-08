import { useState } from "react"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import type { Attribute } from "../../../../models/sheet/Attribute"
import type { Skill } from "../../../../models/sheet/Skills"
import { SelectSkillModule } from "./selectCharacterSkills"


type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

const SKILLS: Array<{ key: Skill; label: string; ability: Attribute }> = [
  { key: "acrobatics", label: "Acrobacia", ability: "dex" },
  { key: "arcana", label: "Arcanismo", ability: "int" },
  { key: "athletics", label: "Atletismo", ability: "str" },
  { key: "performance", label: "Atuação", ability: "cha" },
  { key: "deception", label: "Blefe", ability: "cha" },
  { key: "stealth", label: "Furtividade", ability: "dex" },
  { key: "history", label: "História", ability: "int" },
  { key: "intimidation", label: "Intimidação", ability: "cha" },
  { key: "insight", label: "Intuição", ability: "wis" },
  { key: "investigation", label: "Investigação", ability: "int" },
  { key: "animalHandling", label: "Lidar com Animais", ability: "wis" },
  { key: "medicine", label: "Medicina", ability: "wis" },
  { key: "nature", label: "Natureza", ability: "int" },
  { key: "perception", label: "Percepção", ability: "wis" },
  { key: "persuasion", label: "Persuasão", ability: "cha" },
  { key: "sleightOfHand", label: "Prestidigitação", ability: "dex" },
  { key: "religion", label: "Religião", ability: "int" },
  { key: "survival", label: "Sobrevivência", ability: "wis" },
]

export function Skills({
  character,
  updateCharacter,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const profBonus = character.getProficiencyBonus()

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-textH transition-opacity hover:opacity-80"
      >
        <span>{isOpen ? "▼" : "▶"}</span>
        <span>Perícias</span>
      </button>

      {isOpen && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {SKILLS.map((skill) => (
            <SelectSkillModule
              key={skill.key}
              character={character}
              updateCharacter={updateCharacter}
              skillKey={skill.key}
              label={skill.label}
              ability={skill.ability}
              profBonus={profBonus}
            />
          ))}
        </div>
      )}
    </div>
  )
}