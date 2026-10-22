import type {
  SessionActionRollResult,
  SessionResolvedDamageRoll,
  SessionDiceRollGroupResult,
} from "../../session-protocol/src/diceRoll.ts";

export const CRITICAL_PRESETS = {
  standard: "roll(dice, 2) + mod",
  maximum: "roll(dice) + maxDice(dice) + mod",
  floor: "max(roll(dice, 2), maxDice(dice)) + mod",
} as const;
export type CriticalDamageSettings = {
  mode: keyof typeof CRITICAL_PRESETS | "custom";
  formula?: string;
};
export function criticalFormula(settings?: CriticalDamageSettings): string {
  return settings?.mode === "custom"
    ? (settings.formula ?? "")
    : CRITICAL_PRESETS[settings?.mode ?? "standard"];
}

type Node =
  | { kind: "number"; value: number }
  | { kind: "dice"; quantity: number; sides: number }
  | { kind: "mod" }
  | { kind: "roll"; count: number }
  | { kind: "maximum" }
  | { kind: "binary"; op: string; left: Node; right: Node };

// Bounded recursive descent; never executes JavaScript or arbitrary identifiers.
function parse(input: string): Node {
  if (!input.trim() || input.length > 240)
    throw new Error("Use uma fórmula com 1 a 240 caracteres.");
  const tokens =
    input.toLowerCase().match(/\d+d\d+|\d+(?:\.\d+)?|[a-z]+|[^\s]/g) ?? [];
  let at = 0,
    depth = 0,
    rolls = 0,
    extraDice = 0;
  const take = (token: string) => {
    if (tokens[at++] !== token) throw new Error(`Esperado: ${token}.`);
  };
  function primary(): Node {
    if (++depth > 24) throw new Error("Fórmula muito aninhada.");
    try {
      const token = tokens[at++];
      if (token === "(") {
        const node = expression();
        take(")");
        return node;
      }
      if (token === "-")
        return {
          kind: "binary",
          op: "*",
          left: { kind: "number", value: -1 },
          right: primary(),
        };
      if (token === "mod") return { kind: "mod" };
      if (token === "roll" || token === "maxdice") {
        take("(");
        take("dice");
        let count = 1;
        if (token === "roll" && tokens[at] === ",") {
          at++;
          count = Number(tokens[at++]);
        }
        take(")");
        if (!Number.isInteger(count) || count < 1 || count > 4)
          throw new Error("roll aceita multiplicadores inteiros de 1 a 4.");
        if (token === "roll" && (rolls += count) > 8)
          throw new Error("Use no máximo 8 conjuntos de dados.");
        return token === "roll" ? { kind: "roll", count } : { kind: "maximum" };
      }
      if (token === "max" || token === "min") {
        take("(");
        const left = expression();
        take(",");
        const right = expression();
        take(")");
        return { kind: "binary", op: token, left, right };
      }
      if (token && /^\d+d\d+$/.test(token)) {
        const [quantity, sides] = token.split("d").map(Number);
        if (
          quantity < 1 ||
          quantity > 100 ||
          sides < 2 ||
          sides > 1000 ||
          (extraDice += quantity) > 200
        )
          throw new Error(
            "Dados extras: até 100 por grupo, 1000 lados e 200 no total.",
          );
        return { kind: "dice", quantity, sides };
      }
      if (token && /^\d+(\.\d+)?$/.test(token) && Number(token) <= 100000)
        return { kind: "number", value: Number(token) };
      throw new Error(
        "Termo inválido. Use roll(dice), maxDice(dice), mod, NdS, max ou min.",
      );
    } finally {
      depth--;
    }
  }
  function product(): Node {
    let left = primary();
    while (tokens[at] === "*" || tokens[at] === "/") {
      const op = tokens[at++];
      left = { kind: "binary", op, left, right: primary() };
    }
    return left;
  }
  function expression(): Node {
    let left = product();
    while (tokens[at] === "+" || tokens[at] === "-") {
      const op = tokens[at++];
      left = { kind: "binary", op, left, right: product() };
    }
    return left;
  }
  const root = expression();
  if (at !== tokens.length)
    throw new Error("Separe os termos com operadores; confira os parênteses.");
  return root;
}

type Value = { parts: number[]; groups: SessionDiceRollGroupResult[][] };
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
function evaluate(
  root: Node,
  damages: SessionResolvedDamageRoll[],
  random: (sides: number) => number,
): Value {
  let rolledCount = 0;
  const cursors = damages.map((d) => d.groups.map(() => 0));
  const empty = (): Value => ({
    parts: damages.map(() => 0),
    groups: damages.map(() => []),
  });
  function visit(node: Node): Value {
    const out = empty();
    if (node.kind === "number") {
      out.parts[0] = node.value;
      return out;
    }
    if (node.kind === "mod") {
      out.parts = damages.map((d) => d.modifier);
      return out;
    }
    if (node.kind === "dice") {
      if ((rolledCount += node.quantity) > 1600)
        throw new Error("A fórmula excede 1600 dados.");
      const rolls = Array.from({ length: node.quantity }, () =>
        random(node.sides),
      );
      out.parts[0] = sum(rolls);
      out.groups[0] = [{ quantity: node.quantity, sides: node.sides, rolls }];
      return out;
    }
    if (node.kind === "maximum" || node.kind === "roll") {
      damages.forEach((damage, i) =>
        damage.groups.forEach((group, j) => {
          if (group.quantity % 2 !== 0)
            throw new Error("Quantidade inválida de dados críticos.");
          const base = group.quantity / 2;
          if (node.kind === "maximum") {
            out.parts[i] += base * group.sides;
            return;
          }
          const quantity = base * node.count;
          if ((rolledCount += quantity) > 1600)
            throw new Error("A fórmula excede 1600 dados.");
          const rolls = Array.from(
            { length: quantity },
            () => group.rolls[cursors[i][j]++] ?? random(group.sides),
          );
          out.parts[i] += sum(rolls);
          out.groups[i].push({ quantity, sides: group.sides, rolls });
        }),
      );
      return out;
    }
    const left = visit(node.left),
      right = visit(node.right);
    const a = sum(left.parts),
      b = sum(right.parts);
    if (node.op === "max") return a >= b ? left : right;
    if (node.op === "min") return a <= b ? left : right;
    if (node.op === "+" || node.op === "-")
      return {
        parts: left.parts.map(
          (v, i) => v + (node.op === "+" ? 1 : -1) * right.parts[i],
        ),
        groups: left.groups.map((g, i) => [...g, ...right.groups[i]]),
      };
    if (
      node.right.kind !== "number" &&
      (node.op !== "*" || node.left.kind !== "number")
    )
      throw new Error("Multiplique ou divida apenas por números constantes.");
    const source = node.right.kind === "number" ? left : right;
    const factor = node.right.kind === "number" ? b : a;
    if (node.op === "/" && factor === 0)
      throw new Error("Não é possível dividir por zero.");
    return {
      parts: source.parts.map((v) =>
        node.op === "/" ? v / factor : v * factor,
      ),
      groups: source.groups,
    };
  }
  const result = visit(root);
  if (result.parts.some((v) => !Number.isFinite(v) || Math.abs(v) > 1000000))
    throw new Error("Resultado fora do limite de dano.");
  return result;
}

export function validateCriticalFormula(formula: string): string | null {
  try {
    evaluate(
      parse(formula),
      [
        {
          groups: [{ quantity: 2, sides: 8, rolls: [1, 1] }],
          modifier: 4,
          total: 6,
          critical: true,
        },
      ],
      () => 1,
    );
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Fórmula inválida.";
  }
}
export function isCriticalDamageSettings(
  value: unknown,
): value is CriticalDamageSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const setting = value as CriticalDamageSettings;
  return setting.mode === "custom"
    ? typeof setting.formula === "string" &&
        validateCriticalFormula(setting.formula) === null
    : Object.hasOwn(CRITICAL_PRESETS, setting.mode);
}

function rollCriticalDie(sides: number): number {
  const range = 0x1_0000_0000;
  const limit = range - (range % sides);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % sides) + 1;
}

/** Apply once per hit, including riders; separate spell instances remain independent. */
export function applyCriticalDamageRule(
  result: Pick<
    SessionActionRollResult,
    "damage" | "damages" | "instances" | "details"
  >,
  settings?: CriticalDamageSettings,
  random: (sides: number) => number = rollCriticalDie,
): void {
  if (!settings || settings.mode === "standard") return;
  const formula = criticalFormula(settings),
    root = parse(formula);
  function apply(damages?: SessionResolvedDamageRoll[]) {
    const eligible =
      damages?.filter(
        (d) =>
          d.critical &&
          d.damageType !== "healing" &&
          (d.groups.length > 0 || d.total === d.modifier),
      ) ?? [];
    if (!eligible.length) return;
    const before = sum(eligible.map((d) => d.total)),
      evaluated = evaluate(root, eligible, random);
    eligible.forEach((damage, i) => {
      damage.groups = evaluated.groups[i];
      damage.expression = undefined;
      damage.total = Math.max(0, Math.floor(evaluated.parts[i]));
      damage.modifier =
        damage.total - sum(damage.groups.flatMap((g) => g.rolls));
    });
    result.details = [
      ...(result.details ?? []),
      `Crítico: ${formula} · padrão ${before} → ${sum(eligible.map((d) => d.total))}`,
    ];
  }
  apply([...(result.damage ? [result.damage] : []), ...(result.damages ?? [])]);
  result.instances?.forEach((instance) => apply(instance.damages));
}
