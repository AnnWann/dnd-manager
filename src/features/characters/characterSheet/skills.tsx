import type { Attribute, Character } from "../../../types"
import { abilityModifier, formatSigned } from "../../../lib/rules"
import type { Skill, SkillProficiency } from "./character.types"
import { useState } from "react"

type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
  abilityShort: (ability: Attribute) => string
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

function proficiencyBonus(totalLevel: number) {
  return Math.ceil(totalLevel / 4) + 1
}

function totalCharacterLevel(character: Character) {
  return character.classes.reduce((total, cls) => total + cls.level, 0)
}

function setSkillProficiency(skill: Skill, next: SkillProficiency, updateCharacter: Props["updateCharacter"], character: Character) {
  updateCharacter(character.id, (c) => ({
    ...c,
    skills: {
      ...c.skills,
      [skill]: next,
    },
  }))
}

export function Skills({ character, updateCharacter, abilityShort }: Props) {
  
  const [isOpen, setIsOpen] = useState(false)

  const totalLevel = Math.max(1, totalCharacterLevel(character))
  const profBonus = proficiencyBonus(totalLevel)

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="
          flex items-center gap-2
          text-sm font-medium text-textH
          transition-opacity hover:opacity-80
        "
      >
        <span>{isOpen ? "▼" : "▶"}</span>
        <span>Perícias</span>
      </button>

      {isOpen && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {SKILLS.map((skill) => {
            const proficiency = character.skills[skill.key] ?? "none"
            const abilityMod = abilityModifier(character.attributes[skill.ability])

            const bonus =
              abilityMod +
              (proficiency === "proficient" ? profBonus : 0) +
              (proficiency === "expertise" ? profBonus * 2 : 0)

            return (
              <div
                key={skill.key}
                className="
                  grid grid-cols-[1fr_42px_52px] items-center gap-2
                  rounded-md border border-border px-2 py-1
                "
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-textH">
                    {skill.label}
                  </div>
                  <div className="text-[10px] leading-none text-text">
                    {abilityShort(skill.ability)}
                  </div>
                </div>

                <div className="text-center text-xs font-semibold text-textH">
                  {formatSigned(bonus)}
                </div>

                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    title="Proficiência"
                    onClick={() =>
                      setSkillProficiency(
                        skill.key,
                        proficiency === "proficient" ? "none" : "proficient",
                        updateCharacter,
                        character
                      )
                    }
                    className={
                      proficiency === "proficient" || proficiency === "expertise"
                        ? `
                          h-3 w-3 rounded-full
                          border border-blue-400
                          bg-blue-500
                          shadow-[0_0_6px_rgba(59,130,246,0.7)]
                        `
                        : `
                          h-3 w-3 rounded-full
                          border border-text
                          bg-transparent
                        `
                    }
                  />


                  <button
                    type="button"
                    title="Especialização"
                    onClick={() =>
                      setSkillProficiency(
                        skill.key,
                        proficiency === "expertise" ? "proficient" : "expertise",
                        updateCharacter,
                        character
                      )
                    }
                    className={
                      proficiency === "expertise"
                        ? `
                          h-3 w-3 rounded-full
                          border border-yellow-300
                          bg-yellow-400
                          shadow-[0_0_6px_rgba(250,204,21,0.8)]
                        `
                        : `
                          h-3 w-3 rounded-full
                          border border-text
                          bg-transparent
                        `
                    }
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}