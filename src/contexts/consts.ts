import type { ActionType } from "../models/actions/Actions";
import type { DieSides } from "../models/dice/Die";
import { CLASS_DEFINITIONS } from "../models/leveling/ClassDefinitions";
import type { MagicSchool } from "../models/magic/spells/spellDefinitions";
import type { Attribute } from "../models/sheet/Attribute";
import type { ClassName } from "../models/sheet/Class";

export const MAGIC_SCHOOLS: { value: MagicSchool; label: string }[] = [
  { value: "abjuration", label: "Abjuração" },
  { value: "conjuration", label: "Conjuração" },
  { value: "divination", label: "Adivinhação" },
  { value: "enchantment", label: "Encantamento" },
  { value: "evocation", label: "Evocação" },
  { value: "illusion", label: "Ilusão" },
  { value: "necromancy", label: "Necromancia" },
  { value: "transmutation", label: "Transmutação" },
]

export const MAGIC_SCHOOLS_MAP: Record<MagicSchool | string, string> = {
  "abjuration": "Abjuração",
  "conjuration": "Conjuração",
  "divination": "Adivinhação",
  "enchantment": "Encantamento",
  "evocation": "Evocação",
  "illusion": "Ilusão",
  "necromancy": "Necromancia",
  "transmutation": "Transmutação"
}

export const CLASS_OPTIONS: Array<{ value: ClassName; label: string }> =
  Object.values(CLASS_DEFINITIONS).map((definition) => ({
    value: definition.className,
    label: definition.displayName,
  }));

export const SPELL_CLASS_OPTIONS: Array<{ value: ClassName; label: string }> =
  CLASS_OPTIONS.filter(
    ({ value }) =>
      value !== "barbarian" && value !== "fighter" && value !== "rogue",
  );

export const CLASS_NAMES: Record<ClassName, string> = Object.fromEntries(
  Object.values(CLASS_DEFINITIONS).map((definition) => [
    definition.className,
    definition.displayName,
  ]),
) as Record<ClassName, string>;

export const ACTION_NAMES: Record<ActionType, string> = {
  action: "Ação",
  bonusAction: "Ação Bônus",
  reaction: "Reação",
  legendaryAction: "Ação Lendária",
  legendaryReaction: "Reação Lendária",
  legendaryResistance: "Resistência Lendária",
  interaction: "Interação",
  free: "Livre",
}

type castingTime = Exclude<ActionType, 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'interaction' | 'free'> | 'minute' | 'hour' | 'special'

export const CASTING_TIME_NAMES: Record<castingTime, string> = {
  action: "Ação",
  bonusAction: "Ação Bônus",
  reaction: "Reação",
  minute: "Minuto",
  hour: "Hora",
  special: "Especial",
}

export const DIE_SIDES: DieSides[] = [
  "d2",
  "d3",
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100",
]

export const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" },
  { value: "dex", label: "DES" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "SAB" },
  { value: "cha", label: "CAR" },
]