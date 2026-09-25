import type { CharacterTemplate } from "../../../../../src/models/characters/CharacterTemplate";
import type { Spell } from "../../../../../src/models/magic/spells/Spell";
import type { SpellSource } from "../../../../../src/models/magic/spells/SpellSource";
import {
  evaluateSpellDamageDiceQuantity,
  evaluateSpellScaledNumber,
  getEffectiveSpellResolution,
} from "../../../../../src/models/magic/spells/spellResolution";
import type {
  SessionActionInstanceResult,
  SessionActionRollResult,
  SessionDiceRollMode,
  SessionResolvedD20Roll,
  SessionResolvedDamageRoll,
} from "../../../../../src/shared/session-runtime/diceRollProtocol";

export function resolveSpellCastAction(args: {
  requestId: string;
  actorId: string;
  character: CharacterTemplate;
  spell: Spell;
  source: SpellSource;
  castLevel: number;
  mode: SessionDiceRollMode;
}): SessionActionRollResult {
  const { requestId, actorId, character, spell, source, castLevel, mode } = args;
  const attribute = source.attribute;
  const modifier = character.getEffectiveAttributeModifier(attribute);
  const proficiency = character.getProficiencyBonus();
  const resolution = getEffectiveSpellResolution(spell);
  const characterLevel = (character.get("sheet").classes ?? [])
    .reduce((total, entry) => total + Math.max(0, Math.trunc(entry.level)), 0);
  const context = { castLevel, characterLevel };

  const base = {
    id: crypto.randomUUID(),
    requestId,
    actorId,
    characterId: character.get("id"),
    sourceType: "spell" as const,
    title: spell.displayName || spell.name,
    subtitle: `${spell.slotLevel === 0 ? "Truque" : `Magia de nível ${spell.slotLevel}`} · ${source.name}`,
    description: joinDescription(
      spell.description,
      spell.higherLevelText?.trim()
        ? `Em níveis superiores: ${spell.higherLevelText}`
        : undefined,
    ),
    details: [
      `Atributo de conjuração: ${attribute.toUpperCase()}`,
      ...(castLevel > spell.slotLevel ? [`Conjurada no nível ${castLevel}`] : []),
      ...(spell.concentration ? ["Concentração"] : []),
      ...(spell.ritual ? ["Ritual"] : []),
    ],
    castLevel,
    createdAt: new Date().toISOString(),
  };

  const instanceCount = Math.max(
    1,
    evaluateSpellScaledNumber(resolution.instances, context, 1),
  );

  if (resolution.roll.type === "attack") {
    const attackModifier = character.getEffectiveSpellAttackBonus(
      attribute,
      modifier + proficiency,
    );
    const instances: SessionActionInstanceResult[] = Array.from(
      { length: instanceCount },
      (_, index) => {
        const attack = rollD20(mode, attackModifier);
        const critical = attack.natural === 20;
        return {
          label: instanceCount > 1 ? `Ataque ${index + 1}` : "Ataque",
          attack,
          damages: resolveDamageComponents(
            character,
            resolution.damage ?? [],
            context,
            attribute,
            critical,
            new Set(["hit", "always"]),
          ),
        };
      },
    );

    return {
      ...base,
      instances,
      critical: instances.some((entry) => entry.attack?.natural === 20),
    };
  }

  if (resolution.roll.type === "save") {
    return {
      ...base,
      save: {
        attribute: resolution.roll.attribute,
        dc: character.getEffectiveSpellSaveDc(
          attribute,
          8 + modifier + proficiency,
        ),
        onSuccess: resolution.roll.onSuccess,
      },
      damages: resolveDamageComponents(
        character,
        resolution.damage ?? [],
        context,
        attribute,
        false,
        new Set(["failed-save", "successful-save", "always"]),
      ),
      critical: false,
    };
  }

  if (instanceCount > 1) {
    return {
      ...base,
      instances: Array.from({ length: instanceCount }, (_, index) => ({
        label: `Instância ${index + 1}`,
        damages: resolveDamageComponents(
          character,
          resolution.damage ?? [],
          context,
          attribute,
          false,
          new Set(["always"]),
        ),
      })),
      critical: false,
    };
  }

  return {
    ...base,
    damages: resolveDamageComponents(
      character,
      resolution.damage ?? [],
      context,
      attribute,
      false,
      new Set(["always"]),
    ),
    critical: false,
  };
}

function resolveDamageComponents(
  character: CharacterTemplate,
  components: NonNullable<ReturnType<typeof getEffectiveSpellResolution>["damage"]>,
  context: { castLevel: number; characterLevel: number },
  attribute: SpellSource["attribute"],
  critical: boolean,
  allowedApplications: ReadonlySet<string>,
): SessionResolvedDamageRoll[] {
  return components
    .filter((component) => allowedApplications.has(component.appliesOn))
    .map((component) => {
      const baseQuantity = evaluateSpellDamageDiceQuantity(component, context);
      const doublesOnCritical =
        component.critical ?? component.appliesOn === "hit";
      const quantity = critical && doublesOnCritical
        ? baseQuantity * 2
        : baseQuantity;
      const sides = parseDieSides(component.dice.sides);
      const groups = quantity > 0
        ? [{
            quantity,
            sides,
            rolls: Array.from({ length: quantity }, () => rollServerDie(sides)),
          }]
        : [];
      const flat = Math.trunc(component.flat ?? 0);
      const castingModifier = component.addCastingModifier
        ? character.getEffectiveAttributeModifier(attribute)
        : 0;
      const modifier = character.getEffectiveSpellDamageBonus(
        attribute,
        flat + castingModifier,
      );
      const diceTotal = groups.reduce(
        (sum, group) => sum + group.rolls.reduce((groupSum, value) => groupSum + value, 0),
        0,
      );
      return {
        groups,
        modifier,
        total: diceTotal + modifier,
        critical: critical && doublesOnCritical,
        label: component.label?.trim() || "Dano",
        damageType: component.damageType?.trim() || undefined,
      };
    });
}

function rollD20(
  mode: SessionDiceRollMode,
  modifier: number,
): SessionResolvedD20Roll {
  const rolls = mode === "normal"
    ? [rollServerDie(20)]
    : [rollServerDie(20), rollServerDie(20)];
  const kept = mode === "advantage"
    ? Math.max(...rolls)
    : mode === "disadvantage"
      ? Math.min(...rolls)
      : rolls[0];

  return {
    mode,
    groups: [{ quantity: rolls.length, sides: 20, rolls, kept }],
    modifier,
    total: kept + modifier,
    natural: kept,
  };
}

function parseDieSides(value: number | string): number {
  const parsed = typeof value === "number"
    ? value
    : Number(String(value).trim().toLowerCase().replace(/^d/, ""));
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 1000) {
    throw new Error(`Invalid authoritative die sides: ${String(value)}`);
  }
  return parsed;
}

function rollServerDie(sides: number): number {
  const range = 0x1_0000_0000;
  const limit = range - (range % sides);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % sides) + 1;
}

function joinDescription(...parts: Array<string | undefined>): string | undefined {
  const content = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return content.length ? content.join("\n\n") : undefined;
}
