import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import type { Proficiency, ProficiencyCategory } from "../sheet/Proficiency"
import type { Skill } from "../sheet/Skills"

export type ClassProficiencySelection = {
  className: ClassName
  previousLevel: number
  selectedSkills?: Skill[]
  selectedToolOrInstrument?: string
}

export type ClassSkillRule = {
  count: number
  options: Skill[] | "any"
}

export type ClassProficiencyRule = {
  savingThrows: Attribute[]
  initial: Proficiency[]
  multiclass: Proficiency[]
  initialSkills: ClassSkillRule
  multiclassSkills?: ClassSkillRule
  multiclassChoiceLabel?: string
  multiclassChoiceCategory?: ProficiencyCategory
}

const skill = (...options: Skill[]): Skill[] => options
const proficiency = (
  className: ClassName,
  id: string,
  name: string,
  category: ProficiencyCategory,
  notes?: string,
): Proficiency => ({
  id: `class-${className}-${id}`,
  name,
  category,
  notes,
})

export const CLASS_PROFICIENCY_RULES: Record<
  ClassName,
  ClassProficiencyRule
> = {
  artificer: {
    savingThrows: ["con", "int"],
    initial: [
      proficiency("artificer", "armor-light", "Armaduras leves", "armor"),
      proficiency("artificer", "armor-medium", "Armaduras médias", "armor"),
      proficiency("artificer", "shields", "Escudos", "shield"),
      proficiency("artificer", "simple-weapons", "Armas simples", "weapon"),
      proficiency("artificer", "thieves-tools", "Ferramentas de ladrão", "tool"),
      proficiency("artificer", "tinkers-tools", "Ferramentas de funileiro", "tool"),
      proficiency(
        "artificer",
        "artisan-tool-default",
        "Ferramentas de ferreiro",
        "tool",
        "Escolha padrão para a ferramenta de artesão concedida pela classe; pode ser editada na ficha.",
      ),
    ],
    multiclass: [
      proficiency("artificer", "mc-armor-light", "Armaduras leves", "armor"),
      proficiency("artificer", "mc-armor-medium", "Armaduras médias", "armor"),
      proficiency("artificer", "mc-shields", "Escudos", "shield"),
      proficiency("artificer", "mc-thieves-tools", "Ferramentas de ladrão", "tool"),
      proficiency("artificer", "mc-tinkers-tools", "Ferramentas de funileiro", "tool"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "arcana",
        "history",
        "investigation",
        "medicine",
        "nature",
        "perception",
        "sleightOfHand",
      ),
    },
  },
  barbarian: {
    savingThrows: ["str", "con"],
    initial: [
      proficiency("barbarian", "armor-light", "Armaduras leves", "armor"),
      proficiency("barbarian", "armor-medium", "Armaduras médias", "armor"),
      proficiency("barbarian", "shields", "Escudos", "shield"),
      proficiency("barbarian", "simple-weapons", "Armas simples", "weapon"),
      proficiency("barbarian", "martial-weapons", "Armas marciais", "weapon"),
    ],
    multiclass: [
      proficiency("barbarian", "mc-shields", "Escudos", "shield"),
      proficiency("barbarian", "mc-simple-weapons", "Armas simples", "weapon"),
      proficiency("barbarian", "mc-martial-weapons", "Armas marciais", "weapon"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "animalHandling",
        "athletics",
        "intimidation",
        "nature",
        "perception",
        "survival",
      ),
    },
  },
  bard: {
    savingThrows: ["dex", "cha"],
    initial: [
      proficiency("bard", "armor-light", "Armaduras leves", "armor"),
      proficiency("bard", "simple-weapons", "Armas simples", "weapon"),
      proficiency("bard", "hand-crossbow", "Besta de mão", "weapon"),
      proficiency("bard", "longsword", "Espada longa", "weapon"),
      proficiency("bard", "rapier", "Rapieira", "weapon"),
      proficiency("bard", "shortsword", "Espada curta", "weapon"),
      proficiency(
        "bard",
        "instrument-lute",
        "Alaúde",
        "instrument",
        "Primeiro instrumento padrão; pode ser editado na ficha.",
      ),
      proficiency(
        "bard",
        "instrument-flute",
        "Flauta",
        "instrument",
        "Segundo instrumento padrão; pode ser editado na ficha.",
      ),
      proficiency(
        "bard",
        "instrument-drum",
        "Tambor",
        "instrument",
        "Terceiro instrumento padrão; pode ser editado na ficha.",
      ),
    ],
    multiclass: [
      proficiency("bard", "mc-armor-light", "Armaduras leves", "armor"),
    ],
    initialSkills: { count: 3, options: "any" },
    multiclassSkills: { count: 1, options: "any" },
    multiclassChoiceLabel: "Instrumento musical da multiclasse",
    multiclassChoiceCategory: "instrument",
  },
  cleric: {
    savingThrows: ["wis", "cha"],
    initial: [
      proficiency("cleric", "armor-light", "Armaduras leves", "armor"),
      proficiency("cleric", "armor-medium", "Armaduras médias", "armor"),
      proficiency("cleric", "shields", "Escudos", "shield"),
      proficiency("cleric", "simple-weapons", "Armas simples", "weapon"),
    ],
    multiclass: [
      proficiency("cleric", "mc-armor-light", "Armaduras leves", "armor"),
      proficiency("cleric", "mc-armor-medium", "Armaduras médias", "armor"),
      proficiency("cleric", "mc-shields", "Escudos", "shield"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "history",
        "insight",
        "medicine",
        "persuasion",
        "religion",
      ),
    },
  },
  druid: {
    savingThrows: ["int", "wis"],
    initial: [
      proficiency("druid", "armor-light", "Armaduras leves não metálicas", "armor"),
      proficiency("druid", "armor-medium", "Armaduras médias não metálicas", "armor"),
      proficiency("druid", "shields", "Escudos não metálicos", "shield"),
      proficiency(
        "druid",
        "druid-weapons",
        "Armas druídicas",
        "weapon",
        "Clavas, adagas, dardos, azagaias, maças, bordões, cimitarras, foices, fundas e lanças.",
      ),
      proficiency("druid", "herbalism", "Kit de herbalismo", "tool"),
    ],
    multiclass: [
      proficiency("druid", "mc-armor-light", "Armaduras leves não metálicas", "armor"),
      proficiency("druid", "mc-armor-medium", "Armaduras médias não metálicas", "armor"),
      proficiency("druid", "mc-shields", "Escudos não metálicos", "shield"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "arcana",
        "animalHandling",
        "insight",
        "medicine",
        "nature",
        "perception",
        "religion",
        "survival",
      ),
    },
  },
  fighter: {
    savingThrows: ["str", "con"],
    initial: [
      proficiency("fighter", "all-armor", "Todas as armaduras", "armor"),
      proficiency("fighter", "shields", "Escudos", "shield"),
      proficiency("fighter", "simple-weapons", "Armas simples", "weapon"),
      proficiency("fighter", "martial-weapons", "Armas marciais", "weapon"),
    ],
    multiclass: [
      proficiency("fighter", "mc-armor-light", "Armaduras leves", "armor"),
      proficiency("fighter", "mc-armor-medium", "Armaduras médias", "armor"),
      proficiency("fighter", "mc-shields", "Escudos", "shield"),
      proficiency("fighter", "mc-simple-weapons", "Armas simples", "weapon"),
      proficiency("fighter", "mc-martial-weapons", "Armas marciais", "weapon"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "acrobatics",
        "animalHandling",
        "athletics",
        "history",
        "insight",
        "intimidation",
        "perception",
        "survival",
      ),
    },
  },
  monk: {
    savingThrows: ["str", "dex"],
    initial: [
      proficiency("monk", "simple-weapons", "Armas simples", "weapon"),
      proficiency("monk", "shortsword", "Espadas curtas", "weapon"),
      proficiency(
        "monk",
        "artisan-tool-default",
        "Ferramentas de calígrafo",
        "tool",
        "Escolha padrão para a ferramenta de artesão ou instrumento musical concedido pela classe; pode ser editada na ficha.",
      ),
    ],
    multiclass: [
      proficiency("monk", "mc-simple-weapons", "Armas simples", "weapon"),
      proficiency("monk", "mc-shortsword", "Espadas curtas", "weapon"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "acrobatics",
        "athletics",
        "history",
        "insight",
        "religion",
        "stealth",
      ),
    },
  },
  paladin: {
    savingThrows: ["wis", "cha"],
    initial: [
      proficiency("paladin", "all-armor", "Todas as armaduras", "armor"),
      proficiency("paladin", "shields", "Escudos", "shield"),
      proficiency("paladin", "simple-weapons", "Armas simples", "weapon"),
      proficiency("paladin", "martial-weapons", "Armas marciais", "weapon"),
    ],
    multiclass: [
      proficiency("paladin", "mc-armor-light", "Armaduras leves", "armor"),
      proficiency("paladin", "mc-armor-medium", "Armaduras médias", "armor"),
      proficiency("paladin", "mc-shields", "Escudos", "shield"),
      proficiency("paladin", "mc-simple-weapons", "Armas simples", "weapon"),
      proficiency("paladin", "mc-martial-weapons", "Armas marciais", "weapon"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "athletics",
        "insight",
        "intimidation",
        "medicine",
        "persuasion",
        "religion",
      ),
    },
  },
  ranger: {
    savingThrows: ["str", "dex"],
    initial: [
      proficiency("ranger", "armor-light", "Armaduras leves", "armor"),
      proficiency("ranger", "armor-medium", "Armaduras médias", "armor"),
      proficiency("ranger", "shields", "Escudos", "shield"),
      proficiency("ranger", "simple-weapons", "Armas simples", "weapon"),
      proficiency("ranger", "martial-weapons", "Armas marciais", "weapon"),
    ],
    multiclass: [
      proficiency("ranger", "mc-armor-light", "Armaduras leves", "armor"),
      proficiency("ranger", "mc-armor-medium", "Armaduras médias", "armor"),
      proficiency("ranger", "mc-shields", "Escudos", "shield"),
      proficiency("ranger", "mc-simple-weapons", "Armas simples", "weapon"),
      proficiency("ranger", "mc-martial-weapons", "Armas marciais", "weapon"),
    ],
    initialSkills: {
      count: 3,
      options: skill(
        "animalHandling",
        "athletics",
        "insight",
        "investigation",
        "nature",
        "perception",
        "stealth",
        "survival",
      ),
    },
    multiclassSkills: {
      count: 1,
      options: skill(
        "animalHandling",
        "athletics",
        "insight",
        "investigation",
        "nature",
        "perception",
        "stealth",
        "survival",
      ),
    },
  },
  rogue: {
    savingThrows: ["dex", "int"],
    initial: [
      proficiency("rogue", "armor-light", "Armaduras leves", "armor"),
      proficiency("rogue", "simple-weapons", "Armas simples", "weapon"),
      proficiency("rogue", "hand-crossbow", "Besta de mão", "weapon"),
      proficiency("rogue", "longsword", "Espada longa", "weapon"),
      proficiency("rogue", "rapier", "Rapieira", "weapon"),
      proficiency("rogue", "shortsword", "Espada curta", "weapon"),
      proficiency("rogue", "thieves-tools", "Ferramentas de ladrão", "tool"),
    ],
    multiclass: [
      proficiency("rogue", "mc-armor-light", "Armaduras leves", "armor"),
      proficiency("rogue", "mc-thieves-tools", "Ferramentas de ladrão", "tool"),
    ],
    initialSkills: {
      count: 4,
      options: skill(
        "acrobatics",
        "athletics",
        "deception",
        "insight",
        "intimidation",
        "investigation",
        "perception",
        "performance",
        "persuasion",
        "sleightOfHand",
        "stealth",
      ),
    },
    multiclassSkills: { count: 1, options: "any" },
  },
  sorcerer: {
    savingThrows: ["con", "cha"],
    initial: [
      proficiency(
        "sorcerer",
        "weapons",
        "Adagas, dardos, fundas, bordões e bestas leves",
        "weapon",
      ),
    ],
    multiclass: [],
    initialSkills: {
      count: 2,
      options: skill(
        "arcana",
        "deception",
        "insight",
        "intimidation",
        "persuasion",
        "religion",
      ),
    },
  },
  warlock: {
    savingThrows: ["wis", "cha"],
    initial: [
      proficiency("warlock", "armor-light", "Armaduras leves", "armor"),
      proficiency("warlock", "simple-weapons", "Armas simples", "weapon"),
    ],
    multiclass: [
      proficiency("warlock", "mc-armor-light", "Armaduras leves", "armor"),
      proficiency("warlock", "mc-simple-weapons", "Armas simples", "weapon"),
    ],
    initialSkills: {
      count: 2,
      options: skill(
        "arcana",
        "deception",
        "history",
        "intimidation",
        "investigation",
        "nature",
        "religion",
      ),
    },
  },
  wizard: {
    savingThrows: ["int", "wis"],
    initial: [
      proficiency(
        "wizard",
        "weapons",
        "Adagas, dardos, fundas, bordões e bestas leves",
        "weapon",
      ),
    ],
    multiclass: [],
    initialSkills: {
      count: 2,
      options: skill(
        "arcana",
        "history",
        "insight",
        "investigation",
        "medicine",
        "religion",
      ),
    },
  },
}

export function getClassProficiencyRule(
  className: ClassName,
): ClassProficiencyRule {
  return CLASS_PROFICIENCY_RULES[className]
}

export function applyClassProficiencies(
  character: CharacterTemplate,
  selections: ClassProficiencySelection[],
  initialClassName?: ClassName,
): CharacterTemplate {
  const proficiencies = [...(character.get("sheet").proficiencies ?? [])]
  const skills = { ...(character.get("sheet").skills ?? {}) }
  const savingThrows = {
    ...(character.get("sheet").savingThrowProficiencies ?? {}),
  }

  for (const selection of selections) {
    const rule = getClassProficiencyRule(selection.className)
    const isInitialClass = selection.className === initialClassName
    const granted = isInitialClass ? rule.initial : rule.multiclass

    for (const entry of granted) addUniqueProficiency(proficiencies, entry)
    for (const selectedSkill of selection.selectedSkills ?? []) {
      skills[selectedSkill] = "proficient"
      addUniqueProficiency(proficiencies, {
        id: `class-${selection.className}-skill-${selectedSkill}`,
        name: selectedSkill,
        category: "skill",
        notes: isInitialClass
          ? "Perícia escolhida pela classe inicial."
          : "Perícia concedida pela multiclasse.",
      })
    }

    if (
      !isInitialClass &&
      selection.selectedToolOrInstrument?.trim() &&
      rule.multiclassChoiceCategory
    ) {
      addUniqueProficiency(proficiencies, {
        id: `class-${selection.className}-multiclass-choice`,
        name: selection.selectedToolOrInstrument.trim(),
        category: rule.multiclassChoiceCategory,
        notes: "Escolha concedida pela multiclasse.",
      })
    }

    if (isInitialClass) {
      for (const attribute of rule.savingThrows) {
        savingThrows[attribute] = true
      }
    }
  }

  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      proficiencies,
      skills,
      savingThrowProficiencies: savingThrows,
    },
  })
}

export function validateClassProficiencySelections(
  selections: ClassProficiencySelection[],
  initialClassName?: ClassName,
): string {
  for (const selection of selections) {
    const rule = getClassProficiencyRule(selection.className)
    const skillRule =
      selection.className === initialClassName
        ? rule.initialSkills
        : rule.multiclassSkills
    const selectedSkills = Array.from(new Set(selection.selectedSkills ?? []))

    if (skillRule && selectedSkills.length !== skillRule.count) {
      return `${classLabel(selection.className)} precisa escolher ${skillRule.count} ${skillRule.count === 1 ? "perícia" : "perícias"}.`
    }
    if (
      skillRule &&
      skillRule.options !== "any" &&
      selectedSkills.some((skillName) => !skillRule.options.includes(skillName))
    ) {
      return `${classLabel(selection.className)} possui uma perícia fora da lista permitida.`
    }
    if (
      selection.className !== initialClassName &&
      rule.multiclassChoiceLabel &&
      !selection.selectedToolOrInstrument?.trim()
    ) {
      return `Informe ${rule.multiclassChoiceLabel.toLocaleLowerCase("pt-BR")}.`
    }
  }

  return ""
}

function addUniqueProficiency(
  target: Proficiency[],
  proficiencyToAdd: Proficiency,
): void {
  const normalized = `${proficiencyToAdd.category}:${proficiencyToAdd.name}`
    .toLocaleLowerCase("pt-BR")
  if (
    target.some(
      (entry) =>
        `${entry.category}:${entry.name}`.toLocaleLowerCase("pt-BR") ===
        normalized,
    )
  ) {
    return
  }
  target.push({ ...proficiencyToAdd })
}

function classLabel(className: ClassName): string {
  const labels: Record<ClassName, string> = {
    artificer: "Artífice",
    barbarian: "Bárbaro",
    bard: "Bardo",
    cleric: "Clérigo",
    druid: "Druida",
    fighter: "Guerreiro",
    monk: "Monge",
    paladin: "Paladino",
    ranger: "Patrulheiro",
    rogue: "Ladino",
    sorcerer: "Feiticeiro",
    warlock: "Bruxo",
    wizard: "Mago",
  }
  return labels[className]
}
