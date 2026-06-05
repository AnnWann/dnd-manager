import type { Skill, SkillProficiency } from "./Skills";

export type CharacterSkills = Partial<
  Record<Skill, SkillProficiency>
>