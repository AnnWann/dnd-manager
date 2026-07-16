import type { JsonValue } from '../../models/customSystems/CustomGenerals'
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'

export type CustomFormulaResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: string }

export type CustomFormulaVariable = {
  path: string
  label: string
  valueType: 'number' | 'text' | 'boolean'
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'leftParen' }
  | { type: 'rightParen' }
  | { type: 'comma' }
  | { type: 'eof' }

export function listCustomFormulaVariables(
  definition: CustomSystemDefinition,
): CustomFormulaVariable[] {
  const fieldVariables = definition.fields
    .filter((field) => field.type !== 'formula')
    .map((field) => ({
      path: `field.${field.id}`,
      label: field.name,
      valueType:
        field.type === 'number'
          ? 'number' as const
          : field.type === 'boolean'
            ? 'boolean' as const
            : 'text' as const,
    }))

  const resourceVariables = definition.resources.flatMap((resource) => [
    {
      path: `resource.${resource.id}.current`,
      label: `${resource.name} — atual`,
      valueType: 'number' as const,
    },
    {
      path: `resource.${resource.id}.maximum`,
      label: `${resource.name} — máximo`,
      valueType: 'number' as const,
    },
    {
      path: `resource.${resource.id}.temporary`,
      label: `${resource.name} — temporário`,
      valueType: 'number' as const,
    },
  ])

  return [...fieldVariables, ...resourceVariables]
}

export function evaluateCustomFormula(
  formula: string,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
): CustomFormulaResult {
  try {
    const parser = new FormulaParser(
      tokenize(formula),
      (path) => resolveVariable(path, definition, state),
    )
    const value = parser.parse()
    return { ok: true, value: normalizeResult(value) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Fórmula inválida.',
    }
  }
}

export function validateCustomFormula(
  formula: string,
  definition: CustomSystemDefinition,
): string | undefined {
  const mockState: CharacterCustomSystemState = {
    systemId: definition.id,
    systemVersion: definition.version,
    enabled: true,
    fields: Object.fromEntries(
      definition.fields
        .filter((field) => field.type !== 'formula')
        .map((field) => [field.id, field.type === 'boolean' ? false : field.type === 'number' ? 0 : '']),
    ),
    resources: Object.fromEntries(
      definition.resources.map((resource) => [resource.id, {
        current: resource.initialValue ?? 0,
        maximum: resource.maximum,
        temporary: 0,
      }]),
    ),
    abilities: [],
  }

  const result = evaluateCustomFormula(formula, definition, mockState)
  return result.ok ? undefined : result.error
}

function resolveVariable(
  path: string,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
): unknown {
  const parts = path.split('.')

  if (parts[0] === 'field' && parts.length === 2) {
    const field = definition.fields.find((entry) => entry.id === parts[1])
    if (!field) throw new Error(`Variável desconhecida: ${path}`)
    if (field.type === 'formula') {
      const result = evaluateCustomFormula(field.formula, definition, state)
      if (!result.ok) throw new Error(result.error)
      return result.value
    }
    return state.fields[field.id] ?? field.defaultValue ?? defaultValueForField(field.type)
  }

  if (parts[0] === 'resource' && parts.length === 3) {
    const resource = definition.resources.find((entry) => entry.id === parts[1])
    if (!resource) throw new Error(`Variável desconhecida: ${path}`)
    const resourceState = state.resources[resource.id]
    if (parts[2] === 'current') return resourceState?.current ?? resource.initialValue ?? 0
    if (parts[2] === 'temporary') return resourceState?.temporary ?? 0
    if (parts[2] === 'maximum') {
      if (resourceState?.maximum !== undefined) return resourceState.maximum
      if (resource.maximum !== undefined) return resource.maximum
      if (resource.maximumFormula) {
        const result = evaluateCustomFormula(resource.maximumFormula, definition, state)
        if (!result.ok) throw new Error(result.error)
        return result.value
      }
      return 0
    }
  }

  throw new Error(`Variável desconhecida: ${path}`)
}

function defaultValueForField(type: string): JsonValue {
  if (type === 'number') return 0
  if (type === 'boolean') return false
  if (type === 'multiSelect') return []
  return ''
}

function normalizeResult(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('O resultado da fórmula não é um número finito.')
    return value
  }
  throw new Error('A fórmula produziu um resultado não suportado.')
}

class FormulaParser {
  private index = 0

  constructor(
    private readonly tokens: Token[],
    private readonly resolve: (path: string) => unknown,
  ) {}

  parse(): unknown {
    const value = this.parseOr()
    this.expect('eof')
    return value
  }

  private parseOr(): unknown {
    let left = this.parseAnd()
    while (this.matchOperator('||')) left = Boolean(left) || Boolean(this.parseAnd())
    return left
  }

  private parseAnd(): unknown {
    let left = this.parseEquality()
    while (this.matchOperator('&&')) left = Boolean(left) && Boolean(this.parseEquality())
    return left
  }

  private parseEquality(): unknown {
    let left = this.parseComparison()
    while (true) {
      if (this.matchOperator('==')) left = left === this.parseComparison()
      else if (this.matchOperator('!=')) left = left !== this.parseComparison()
      else break
    }
    return left
  }

  private parseComparison(): unknown {
    let left = this.parseTerm()
    while (true) {
      if (this.matchOperator('>=')) left = toNumber(left) >= toNumber(this.parseTerm())
      else if (this.matchOperator('<=')) left = toNumber(left) <= toNumber(this.parseTerm())
      else if (this.matchOperator('>')) left = toNumber(left) > toNumber(this.parseTerm())
      else if (this.matchOperator('<')) left = toNumber(left) < toNumber(this.parseTerm())
      else break
    }
    return left
  }

  private parseTerm(): unknown {
    let left = this.parseFactor()
    while (true) {
      if (this.matchOperator('+')) {
        const right = this.parseFactor()
        left = typeof left === 'string' || typeof right === 'string'
          ? String(left ?? '') + String(right ?? '')
          : toNumber(left) + toNumber(right)
      } else if (this.matchOperator('-')) left = toNumber(left) - toNumber(this.parseFactor())
      else break
    }
    return left
  }

  private parseFactor(): unknown {
    let left = this.parseUnary()
    while (true) {
      if (this.matchOperator('*')) left = toNumber(left) * toNumber(this.parseUnary())
      else if (this.matchOperator('/')) left = toNumber(left) / toNumber(this.parseUnary())
      else if (this.matchOperator('%')) left = toNumber(left) % toNumber(this.parseUnary())
      else break
    }
    return left
  }

  private parseUnary(): unknown {
    if (this.matchOperator('!')) return !Boolean(this.parseUnary())
    if (this.matchOperator('-')) return -toNumber(this.parseUnary())
    if (this.matchOperator('+')) return toNumber(this.parseUnary())
    return this.parsePrimary()
  }

  private parsePrimary(): unknown {
    const token = this.current()
    if (token.type === 'number' || token.type === 'string' || token.type === 'boolean') {
      this.index += 1
      return token.value
    }
    if (token.type === 'identifier') {
      this.index += 1
      if (this.current().type === 'leftParen') return this.parseFunction(token.value)
      return this.resolve(token.value)
    }
    if (token.type === 'leftParen') {
      this.index += 1
      const value = this.parseOr()
      this.expect('rightParen')
      return value
    }
    throw new Error('Valor esperado na fórmula.')
  }

  private parseFunction(name: string): unknown {
    this.expect('leftParen')
    const args: unknown[] = []
    if (this.current().type !== 'rightParen') {
      do args.push(this.parseOr())
      while (this.match('comma'))
    }
    this.expect('rightParen')

    switch (name) {
      case 'min': return Math.min(...args.map(toNumber))
      case 'max': return Math.max(...args.map(toNumber))
      case 'round': return Math.round(toNumber(args[0]))
      case 'floor': return Math.floor(toNumber(args[0]))
      case 'ceil': return Math.ceil(toNumber(args[0]))
      case 'abs': return Math.abs(toNumber(args[0]))
      case 'clamp': return Math.min(toNumber(args[2]), Math.max(toNumber(args[1]), toNumber(args[0])))
      case 'if': return Boolean(args[0]) ? args[1] : args[2]
      default: throw new Error(`Função desconhecida: ${name}`)
    }
  }

  private current(): Token {
    return this.tokens[this.index] ?? { type: 'eof' }
  }

  private match(type: Token['type']): boolean {
    if (this.current().type !== type) return false
    this.index += 1
    return true
  }

  private matchOperator(value: string): boolean {
    const token = this.current()
    if (token.type !== 'operator' || token.value !== value) return false
    this.index += 1
    return true
  }

  private expect(type: Token['type']): void {
    if (!this.match(type)) throw new Error(`Token esperado: ${type}`)
  }
}

function toNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) throw new Error(`“${String(value)}” não é um número válido.`)
  return number
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < input.length) {
    const char = input[index]
    if (/\s/.test(char)) { index += 1; continue }

    if (/\d|\./.test(char)) {
      const match = input.slice(index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/)
      if (!match) throw new Error('Número inválido.')
      tokens.push({ type: 'number', value: Number(match[0]) })
      index += match[0].length
      continue
    }

    if (char === '"' || char === "'") {
      const quote = char
      let value = ''
      index += 1
      while (index < input.length && input[index] !== quote) {
        if (input[index] === '\\' && index + 1 < input.length) index += 1
        value += input[index]
        index += 1
      }
      if (input[index] !== quote) throw new Error('Texto sem fechamento.')
      index += 1
      tokens.push({ type: 'string', value })
      continue
    }

    const identifier = input.slice(index).match(/^[A-Za-z_][A-Za-z0-9_.-]*/)
    if (identifier) {
      const value = identifier[0]
      if (value === 'true' || value === 'false') tokens.push({ type: 'boolean', value: value === 'true' })
      else tokens.push({ type: 'identifier', value })
      index += value.length
      continue
    }

    const pair = input.slice(index, index + 2)
    if (['>=', '<=', '==', '!=', '&&', '||'].includes(pair)) {
      tokens.push({ type: 'operator', value: pair })
      index += 2
      continue
    }
    if ('+-*/%><!'.includes(char)) {
      tokens.push({ type: 'operator', value: char })
      index += 1
      continue
    }
    if (char === '(') tokens.push({ type: 'leftParen' })
    else if (char === ')') tokens.push({ type: 'rightParen' })
    else if (char === ',') tokens.push({ type: 'comma' })
    else throw new Error(`Caractere inválido na fórmula: ${char}`)
    index += 1
  }

  tokens.push({ type: 'eof' })
  return tokens
}
