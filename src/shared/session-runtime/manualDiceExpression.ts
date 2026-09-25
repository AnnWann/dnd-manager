import type { SessionDiceRollMode } from "./diceRollProtocol"

export const MANUAL_DICE_EXPRESSION_MAX_LENGTH = 160
export const MANUAL_DICE_MAX_GROUPS = 20
export const MANUAL_DICE_MAX_QUANTITY_PER_GROUP = 100
export const MANUAL_DICE_MAX_TOTAL_ROLLED = 200
export const MANUAL_DICE_MAX_SIDES = 1000
export const MANUAL_DICE_MAX_ABSOLUTE_MODIFIER = 100_000

export type ManualDiceTerm = {
  quantity: number
  sides: number
  mode: SessionDiceRollMode
}

export type ParsedManualDiceExpression = {
  expression: string
  terms: ManualDiceTerm[]
  modifier: number
  mode: SessionDiceRollMode
}

export type ManualDiceExpressionParseResult =
  | { ok: true; value: ParsedManualDiceExpression }
  | { ok: false; message: string }

export function parseManualDiceExpression(
  input: string,
): ManualDiceExpressionParseResult {
  const compact = input.trim().toLowerCase().replace(/\s+/g, "")
  if (!compact) {
    return { ok: false, message: "Informe uma expressão de dados." }
  }
  if (compact.length > MANUAL_DICE_EXPRESSION_MAX_LENGTH) {
    return {
      ok: false,
      message: `A expressão pode ter no máximo ${MANUAL_DICE_EXPRESSION_MAX_LENGTH} caracteres.`,
    }
  }

  const terms: ManualDiceTerm[] = []
  let modifier = 0
  let position = 0
  let specialMode: SessionDiceRollMode = "normal"
  let actualDiceCount = 0

  // sign + optional advantage/disadvantage prefix + dice, OR signed integer.
  const token =
    /([+-]?)(?:(a-|d-)?(\d*)d(\d+)|(\d+))/gy

  while (position < compact.length) {
    token.lastIndex = position
    const match = token.exec(compact)
    if (!match || match.index !== position) {
      return {
        ok: false,
        message:
          "Expressão inválida. Use formatos como 1d6 + 2d8 + 6, a-1d20 + 5 ou d-1d20 - 2.",
      }
    }

    const sign = match[1] ?? ""
    const modePrefix = match[2]
    const quantityText = match[3]
    const sidesText = match[4]
    const integerText = match[5]

    if (position > 0 && sign !== "+" && sign !== "-") {
      return {
        ok: false,
        message: "Separe os termos com + ou -.",
      }
    }

    if (sidesText !== undefined) {
      if (sign === "-") {
        return {
          ok: false,
          message:
            "Subtração de grupos de dados não é suportada; use - apenas em modificadores numéricos.",
        }
      }

      const quantity = quantityText ? Number(quantityText) : 1
      const sides = Number(sidesText)
      if (
        !Number.isInteger(quantity)
        || quantity < 1
        || quantity > MANUAL_DICE_MAX_QUANTITY_PER_GROUP
      ) {
        return {
          ok: false,
          message: `Cada grupo pode rolar entre 1 e ${MANUAL_DICE_MAX_QUANTITY_PER_GROUP} dados.`,
        }
      }
      if (
        !Number.isInteger(sides)
        || sides < 2
        || sides > MANUAL_DICE_MAX_SIDES
      ) {
        return {
          ok: false,
          message: `Os dados devem ter entre 2 e ${MANUAL_DICE_MAX_SIDES} lados.`,
        }
      }

      let mode: SessionDiceRollMode = "normal"
      if (modePrefix) {
        mode = modePrefix === "a-" ? "advantage" : "disadvantage"
        if (quantity !== 1 || sides !== 20) {
          return {
            ok: false,
            message: "a- e d- só podem ser usados com um único d20, como a-1d20.",
          }
        }
        if (specialMode !== "normal") {
          return {
            ok: false,
            message: "Use apenas um termo com vantagem ou desvantagem por expressão.",
          }
        }
        specialMode = mode
      }

      terms.push({ quantity, sides, mode })
      if (terms.length > MANUAL_DICE_MAX_GROUPS) {
        return {
          ok: false,
          message: `A expressão pode ter no máximo ${MANUAL_DICE_MAX_GROUPS} grupos de dados.`,
        }
      }

      actualDiceCount += mode === "normal" ? quantity : 2
      if (actualDiceCount > MANUAL_DICE_MAX_TOTAL_ROLLED) {
        return {
          ok: false,
          message: `Uma expressão pode rolar no máximo ${MANUAL_DICE_MAX_TOTAL_ROLLED} dados.`,
        }
      }
    } else if (integerText !== undefined) {
      const amount = Number(integerText)
      if (!Number.isSafeInteger(amount)) {
        return { ok: false, message: "Modificador numérico inválido." }
      }
      modifier += sign === "-" ? -amount : amount
      if (Math.abs(modifier) > MANUAL_DICE_MAX_ABSOLUTE_MODIFIER) {
        return {
          ok: false,
          message: `O modificador total deve ficar entre -${MANUAL_DICE_MAX_ABSOLUTE_MODIFIER} e +${MANUAL_DICE_MAX_ABSOLUTE_MODIFIER}.`,
        }
      }
    }

    position = token.lastIndex
  }

  if (!terms.length) {
    return {
      ok: false,
      message: "A expressão precisa conter pelo menos um grupo de dados.",
    }
  }

  const expression = formatManualDiceExpression(terms, modifier)
  return {
    ok: true,
    value: {
      expression,
      terms,
      modifier,
      mode: specialMode,
    },
  }
}

function formatManualDiceExpression(
  terms: ManualDiceTerm[],
  modifier: number,
): string {
  const dice = terms.map((term) => {
    const prefix =
      term.mode === "advantage"
        ? "a-"
        : term.mode === "disadvantage"
          ? "d-"
          : ""
    return `${prefix}${term.quantity}d${term.sides}`
  }).join(" + ")

  if (modifier > 0) return `${dice} + ${modifier}`
  if (modifier < 0) return `${dice} - ${Math.abs(modifier)}`
  return dice
}
