import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { equipmentBonuses } from "../../../lib/character"
import { clampInt } from "../../../lib/numberFormat"
import { ABILITIES, spellAttackBonus, spellSaveDc, totalLevel } from "../../../lib/rules"
import { CLASS_OPTIONS, classLabel } from "../../../lib/spellLabels"
import type { Attribute, Character } from "../../../models/types"


type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
  abilityShort: (ability: Attribute) => string
  addClassToActive: (classIndex: string) => void
}

export function Class({ character, updateCharacter, abilityShort, addClassToActive }: Props) {
  if (character.type !== 'pc') return null

  const totalCharacterLevel = Math.max(1, totalLevel(character.classes.map((c) => c.level)))
  const eqBonuses = equipmentBonuses(character)

  function getAutoCasterClassIndex(classIndex: string): string | null {
    if (
      classIndex === 'artificer' ||
      classIndex === 'bard' ||
      classIndex === 'cleric' ||
      classIndex === 'druid' ||
      classIndex === 'paladin' ||
      classIndex === 'ranger' ||
      classIndex === 'sorcerer' ||
      classIndex === 'warlock' ||
      classIndex === 'wizard'
    ) {
      return classIndex
    }
    return null
  }

  function getCasterClassLabel(classIndex: string, progression?: 'auto' | 'third'): string {
    if (classIndex === 'fighter') {
      return progression === 'third' ? 'Cavaleiro Arcano (Mago)' : 'Nenhuma'
    }
    if (classIndex === 'rogue') {
      return progression === 'third' ? 'Trapaceiro Arcano (Mago)' : 'Nenhuma'
    }
    const auto = getAutoCasterClassIndex(classIndex)
    if (!auto) return 'Nenhuma'
    const opt = CLASS_OPTIONS.find((c) => c.index === auto)
    return opt?.name ?? auto
  }

  function isCasterEnabled(classIndex: string, progression?: 'auto' | 'third'): boolean {
    const auto = getAutoCasterClassIndex(classIndex)
    if (auto) return true
    return (classIndex === 'fighter' || classIndex === 'rogue') && progression === 'third'
  }

  function isCastingAbilityEditable(classIndex: string, progression?: 'auto' | 'third'): boolean {
    return (classIndex === 'fighter' || classIndex === 'rogue') && progression === 'third'
  }

  function autoCastingAbility(classIndex: string): Attribute {
    if (classIndex === 'fighter' || classIndex === 'rogue') return 'int'
    const opt = CLASS_OPTIONS.find((c) => c.index === classIndex)
    return (opt?.defaultAbility ?? 'int') as Attribute
  }

  function resolvedCastingAbility(classIndex: string, progression: 'auto' | 'third' | undefined, stored: Attribute): Attribute {
    if (classIndex === 'fighter' || classIndex === 'rogue') {
      if (progression === 'third') return stored || 'int'
      return 'int'
    }
    return autoCastingAbility(classIndex)
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-textH">Classes</div>
        <Select
          className="h-9 w-auto px-2 text-xs"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value
            if (!v) return
            addClassToActive(v)
            e.currentTarget.value = ''
          }}
        >
          <option value="">+ Adicionar classe…</option>
          {CLASS_OPTIONS.map((c) => (
            <option key={c.index} value={c.index}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {character.classes.length === 0 ? (
        <p className="mt-2 text-xs text-text">
          Adicione pelo menos uma classe para calcular bônus e auto-atribuir magias.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {character.classes.map((cls) => (
            <div
              key={cls.id}
              className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 md:grid-cols-[1fr_100px_220px_220px_44px]"
            >
              <div className="min-w-0">
                <div className="text-xs text-text">Classe</div>
                <div className="truncate text-sm text-textH">{classLabel(cls)}</div>
              </div>
              <div>
                <div className="text-xs text-text">Nível</div>
                <Input
                  type="number"
                  className="mt-1 h-9 px-2"
                  min={1}
                  max={20}
                  value={cls.level}
                  onChange={(e) => {
                    const level = clampInt(Number(e.target.value), 1, 20)
                    updateCharacter(character.id, (c) => ({
                      ...c,
                      classes: c.classes.map((x) => (x.id === cls.id ? { ...x, level } : x)),
                    }))
                  }}
                />
              </div>
              <div>
                <div className="text-xs text-text">Classe de conjurador</div>
                {(cls.classIndex === 'fighter' || cls.classIndex === 'rogue') ? (
                  <Select
                    className="mt-1 h-9 px-2 py-1"
                    value={cls.spellcastingProgression ?? 'auto'}
                    onChange={(e) => {
                      const v = e.target.value as 'auto' | 'third'
                      updateCharacter(character.id, (c) => ({
                        ...c,
                        classes: c.classes.map((x) =>
                          x.id === cls.id
                            ? {
                                ...x,
                                spellcastingProgression: v === 'auto' ? undefined : v,
                                castingAbility: v === 'third' ? 'int' : x.castingAbility,
                              }
                            : x,
                        ),
                      }))
                    }}
                    title="Escolha opcional de conjurador para classes marciais."
                  >
                    <option value="auto">Nenhuma</option>
                    <option value="third">
                      {cls.classIndex === 'fighter' ? 'Cavaleiro Arcano (Mago)' : 'Trapaceiro Arcano (Mago)'}
                    </option>
                  </Select>
                ) : (
                  <Input
                    className="mt-1 h-9"
                    readOnly
                    value={getCasterClassLabel(cls.classIndex, cls.spellcastingProgression)}
                  />
                )}

                <div className="mt-2 text-xs text-text">Atributo de conjuração</div>
                <Select
                  className="mt-1 h-9 px-2 py-1"
                  value={resolvedCastingAbility(cls.classIndex, cls.spellcastingProgression, cls.castingAbility)}
                  disabled={!isCastingAbilityEditable(cls.classIndex, cls.spellcastingProgression)}
                  onChange={(e) => {
                    const castingAbility = e.target.value as Attribute
                    updateCharacter(character.id, (c) => ({
                      ...c,
                      classes: c.classes.map((x) => (x.id === cls.id ? { ...x, castingAbility } : x)),
                    }))
                  }}
                >
                  {ABILITIES.map((a) => (
                    <option key={a.key} value={a.key}>
                      {abilityShort(a.key)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="text-xs text-text">Bônus de conjuração</div>
                {isCasterEnabled(cls.classIndex, cls.spellcastingProgression) ? (
                  <div className="mt-1 rounded-md border border-border px-2 py-2 text-xs text-textH">
                    {(() => {
                      const abilityKey = resolvedCastingAbility(cls.classIndex, cls.spellcastingProgression, cls.castingAbility)
                      const abilityScore = character.attributes[abilityKey]
                      const atkBase = spellAttackBonus({
                        proficiencyMode: character.proficiencyMode,
                        totalCharacterLevel,
                        classLevel: cls.level,
                        abilityScore,
                      })
                      const atk = atkBase + eqBonuses.attackBonus
                      const dc = spellSaveDc({
                        proficiencyMode: character.proficiencyMode,
                        totalCharacterLevel,
                        classLevel: cls.level,
                        abilityScore,
                      })
                      const atkLabel = atk >= 0 ? `+${atk}` : `${atk}`
                      return `ATK ${atkLabel} • TR ${dc}`
                    })()}
                  </div>
                ) : (
                  <div className="mt-1 rounded-md border border-border px-2 py-2 text-xs text-text">Sem conjuração</div>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    updateCharacter(character.id, (c) => ({
                      ...c,
                      classes: c.classes.filter((x) => x.id !== cls.id),
                      spells: c.spells.map((s) => (s.sourceClassId === cls.id ? { ...s, sourceClassId: undefined } : s)),
                    }))
                  }
                  title="Remover classe"
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}