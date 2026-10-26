/** Dice portion of an ability damage/healing formula. The rest is evaluated by
 * the existing CharacterSheetFormula engine in the web application.
 */
export function parseAbilityDamageFormula(expression: string) {
  if (expression.length > 2000) return undefined
  const input = expression.trim()
  const match = /^([1-9]|1\d|20)d(4|6|8|10|12|20)(.*)$/i.exec(input)
  if (!match) return undefined
  const suffix = match[3].trim()
  if (suffix && !/^[+-](?![+=])/.test(suffix)) return undefined
  return { quantity: Number(match[1]), sides: Number(match[2]), formula: suffix ? `0 ${suffix}` : "0" }
}
