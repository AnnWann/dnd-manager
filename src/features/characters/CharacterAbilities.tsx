import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { Character } from '../../types'

type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}

export function CharacterAbilities({ character, updateCharacter }: Props) {
  const abilities = character.customAbilities ?? []

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
                customAbilities: [...(c.customAbilities ?? []), ''],
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
              <div key={`ability-${idx}`} className="flex items-center gap-2">
                <Input
                  className="h-9"
                  value={abilityText}
                  onChange={(e) =>
                    updateCharacter(character.id, (c) => ({
                      ...c,
                      customAbilities: (c.customAbilities ?? []).map((item, itemIdx) =>
                        itemIdx === idx ? e.target.value : item,
                      ),
                    }))
                  }
                  placeholder="Ex: Sentidos Aguçados, Resistência Mágica..."
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    updateCharacter(character.id, (c) => ({
                      ...c,
                      customAbilities: (c.customAbilities ?? []).filter((_, itemIdx) => itemIdx !== idx),
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
