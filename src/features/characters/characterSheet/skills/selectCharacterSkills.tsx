import { useCharacterWorkspace } from "../../workspace/CharacterWorkspaceContext"
import { attributeShort } from "../../../../lib/attributeShorts"
import { formatSigned } from "../../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import { hasProficiency } from "../../../../models/characters/characterProficiencies"
import type { Attribute } from "../../../../models/sheet/Attribute"
import type { Skill, SkillProficiency } from "../../../../models/sheet/Skills"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  skillKey: Skill
  label: string
  ability: Attribute
  profBonus: number
}

export function SelectSkillModule({
  character,
  updateCharacter,
  skillKey,
  label,
  ability,
  profBonus,
}: Props) {
  const { dispatchSkillOperation } = useCharacterWorkspace()
  const sheet = character.get("sheet")
  const proficiency = sheet.skills[skillKey] ?? "none"
  const grantedProficiency =
    hasProficiency(character, "skill", label) ||
    hasProficiency(character, "skill", skillKey)
  const effectiveProficiency =
    proficiency === "expertise"
      ? "expertise"
      : proficiency === "proficient" || grantedProficiency
        ? "proficient"
        : "none"
  const abilityMod = character.getEffectiveAttributeModifier(ability)

  const bonus =
    abilityMod +
    (effectiveProficiency === "proficient" ? profBonus : 0) +
    (effectiveProficiency === "expertise" ? profBonus * 2 : 0)

  function setProficiency(next: SkillProficiency) {
    if (dispatchSkillOperation({
      type: "character.skill.set",
      characterId: character.get("id"),
      skill: skillKey,
      proficiency: next,
    })) return

    updateCharacter(character.get("id"), (c) =>
      c.withSheet("skills", {
        ...c.get("sheet").skills,
        [skillKey]: next,
      }),
    )
  }

  return (
    <div className="grid grid-cols-[1fr_42px_52px] items-center gap-2 rounded-md border border-border px-2 py-1">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-textH">
          {label}
        </div>

        <div className="text-[10px] leading-none text-text">
          {attributeShort(ability)}
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
            setProficiency(
              proficiency === "proficient" ? "none" : "proficient",
            )
          }
          className={
            effectiveProficiency === "proficient" || effectiveProficiency === "expertise"
              ? "h-3 w-3 rounded-full border border-blue-400 bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)]"
              : "h-3 w-3 rounded-full border border-text bg-transparent"
          }
        />

        <button
          type="button"
          title="Especialização"
          onClick={() =>
            setProficiency(
              proficiency === "expertise" ? "proficient" : "expertise",
            )
          }
          className={
            proficiency === "expertise"
              ? "h-3 w-3 rounded-full border border-yellow-300 bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)]"
              : "h-3 w-3 rounded-full border border-text bg-transparent"
          }
        />
      </div>
    </div>
  )
}
