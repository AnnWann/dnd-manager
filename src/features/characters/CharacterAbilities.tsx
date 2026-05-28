import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import type { AbilityUsageResetKind, Character, CustomAbility } from '../../types'

const USAGE_OPTIONS: Array<{ value: AbilityUsageResetKind; label: string }> = [
  { value: 'turn', label: 'Por turno' },
  { value: 'shortRest', label: 'Por descanso curto' },
  { value: 'longRest', label: 'Por descanso longo' },
]

type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}

export function CharacterAbilities({ character, updateCharacter }: Props) {
  const abilities = character.customAbilities ?? []

  function updateAbility(characterId: string, abilityId: string, updater: (ability: CustomAbility) => CustomAbility) {
    updateCharacter(characterId, (c) => ({
      ...c,
      customAbilities: (c.customAbilities ?? []).map((ability) =>
        ability.id === abilityId ? updater(ability) : ability,
      ),
    }))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-textH">Habilidades</div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              updateCharacter(character.id, (c) => ({
                ...c,
                customAbilities: [...(c.customAbilities ?? []), { id: crypto.randomUUID(), name: '', usage: undefined }],
              }))
            }
          >
            + Adicionar habilidade
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {abilities.length === 0 ? (
          <p className="text-xs text-text">Adicione habilidades livres da ficha (texto simples).</p>
        ) : (
          <div className="grid gap-2">
            {abilities.map((abilityText, idx) => (
              <div key={abilityText.id || `ability-${idx}`} className="grid gap-2 rounded-xl border border-border bg-bg p-3 md:grid-cols-[1fr_180px_96px_96px_32px] md:items-center">
                <Input
                  className="h-9"
                  value={abilityText.name}
                  onChange={(e) =>
                    updateAbility(character.id, abilityText.id, (ability) => ({
                      ...ability,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Ex: Sentidos Aguçados, Resistência Mágica..."
                />

                <Select
                  className="h-9"
                  value={abilityText.usage?.reset ?? ''}
                  onChange={(e) => {
                    const reset = e.target.value as AbilityUsageResetKind | ''
                    updateAbility(character.id, abilityText.id, (ability) => ({
                      ...ability,
                      usage: reset
                        ? {
                            max: Math.max(1, ability.usage?.max ?? 1),
                            used: Math.min(ability.usage?.used ?? 0, Math.max(1, ability.usage?.max ?? 1)),
                            reset,
                          }
                        : undefined,
                    }))
                  }}
                >
                  <option value="">Sem uso</option>
                  {USAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>

                <Input
                  className="h-9"
                  type="number"
                  min={1}
                  value={abilityText.usage?.max ?? ''}
                  onChange={(e) =>
                    updateAbility(character.id, abilityText.id, (ability) => {
                      const max = Math.max(1, Number(e.target.value) || 1)
                      const used = Math.min(ability.usage?.used ?? 0, max)
                      return {
                        ...ability,
                        usage: ability.usage
                          ? {
                              ...ability.usage,
                              max,
                              used,
                            }
                          : {
                              max,
                              used: 0,
                              reset: 'longRest',
                            },
                      }
                    })
                  }
                  placeholder="Qtd"
                />

                <Input
                  className="h-9"
                  type="number"
                  min={0}
                  value={abilityText.usage?.used ?? ''}
                  onChange={(e) =>
                    updateAbility(character.id, abilityText.id, (ability) => {
                      const used = Math.max(0, Number(e.target.value) || 0)
                      return {
                        ...ability,
                        usage: ability.usage
                          ? {
                              ...ability.usage,
                              used: Math.min(used, ability.usage.max),
                            }
                          : undefined,
                      }
                    })
                  }
                  placeholder="Usados"
                />

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    updateCharacter(character.id, (c) => ({
                      ...c,
                      customAbilities: (c.customAbilities ?? []).filter((item) => item.id !== abilityText.id),
                    }))
                  }
                  title="Remover habilidade"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
