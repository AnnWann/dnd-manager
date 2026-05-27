import type { Ability, Character } from '../types'
import { ABILITIES, abilityModifier, cantripDiceMultiplier, formatSigned, totalLevel } from '../lib/rules'
import { CLASS_OPTIONS, classDisplayName, classLabel } from '../lib/spellLabels'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'

function badge(text: string) {
  return (
    <span className="inline-flex items-center rounded-md border border-accentBorder bg-accentBg px-2 py-0.5 text-xs text-textH">
      {text}
    </span>
  )
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

export function CharacterView(props: {
  characters: Character[]
  activeCharacter: Character
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  abilityShort: (ability: Ability) => string
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void

  // Classes
  addClassToActive: (classIndex: string) => void

  // Calc
  effectiveCalcClassId: string
  setCalcClassId: (id: string) => void
  disableCalcClassSelect: boolean
  activeCharacterTotalLevel: number
  atk: number
  dc: number
}) {
  const {
    characters,
    activeCharacter,
    setActiveCharacterId,
    addCharacter,
    deleteActiveCharacter,
    disableDelete,
    abilityShort,
    updateCharacter,
    addClassToActive,
    effectiveCalcClassId,
    setCalcClassId,
    disableCalcClassSelect,
    activeCharacterTotalLevel,
    atk,
    dc,
  } = props

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-textH">Personagens</div>
            <Button size="sm" variant="primary" onClick={addCharacter}>
              + Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {characters.map((c) => (
              <button
                key={c.id}
                className={
                  c.id === activeCharacter.id
                    ? 'flex w-full items-center justify-between rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-left'
                    : 'flex w-full items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-left hover:bg-[color:var(--social-bg)]'
                }
                onClick={() => setActiveCharacterId(c.id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-textH">{c.name}</div>
                  <div className="text-xs text-text">
                    {c.spells.length} magias • {totalLevel(c.classes.map((x) => x.level)) || 0} nv
                  </div>
                </div>
                {c.id === activeCharacter.id ? badge('Ativo') : null}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <Button
              className="w-full"
              variant="secondary"
              onClick={deleteActiveCharacter}
              disabled={disableDelete}
              title={disableDelete ? 'Mantenha pelo menos 1 personagem' : 'Excluir personagem'}
            >
              Excluir personagem ativo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Ficha rápida</div>
          <div className="mt-1 text-xs text-text">Nome, atributos e regra de proficiência.</div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full">
              <label className="text-xs text-text">Nome do personagem</label>
              <Input
                className="mt-1"
                value={activeCharacter.name}
                onChange={(e) => updateCharacter(activeCharacter.id, (c) => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div className="w-full md:w-[320px]">
              <label className="text-xs text-text">Cálculo de proficiência</label>
              <Select
                className="mt-1"
                value={activeCharacter.proficiencyMode}
                onChange={(e) =>
                  updateCharacter(activeCharacter.id, (c) => ({
                    ...c,
                    proficiencyMode: e.target.value === 'classLevel' ? 'classLevel' : 'totalLevel',
                  }))
                }
              >
                <option value="totalLevel">Nível total (padrão 5e)</option>
                <option value="classLevel">Por classe (regra da casa)</option>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            {ABILITIES.map(({ key }) => (
              <div key={key}>
                <label className="text-xs text-text">{abilityShort(key)}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="number"
                    className="h-9 px-2"
                    value={activeCharacter.abilities[key]}
                    min={1}
                    max={30}
                    onChange={(e) => {
                      const score = clampInt(Number(e.target.value), 1, 30)
                      updateCharacter(activeCharacter.id, (c) => ({
                        ...c,
                        abilities: { ...c.abilities, [key]: score },
                      }))
                    }}
                  />
                  <div className="w-10 text-right text-xs text-text">
                    {formatSigned(abilityModifier(activeCharacter.abilities[key]))}
                  </div>
                </div>
              </div>
            ))}
          </div>

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

            {activeCharacter.classes.length === 0 ? (
              <p className="mt-2 text-xs text-text">
                Adicione pelo menos uma classe para calcular bônus e auto-atribuir magias.
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                {activeCharacter.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 md:grid-cols-[1fr_100px_160px_44px]"
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
                          updateCharacter(activeCharacter.id, (c) => ({
                            ...c,
                            classes: c.classes.map((x) => (x.id === cls.id ? { ...x, level } : x)),
                          }))
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-text">Atributo (conjuração)</div>
                      <Select
                        className="mt-1 h-9 px-2 py-1"
                        value={cls.castingAbility}
                        onChange={(e) => {
                          const castingAbility = e.target.value as Ability
                          updateCharacter(activeCharacter.id, (c) => ({
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

                      {(cls.classIndex === 'fighter' || cls.classIndex === 'rogue') ? (
                        <div className="mt-2">
                          <div className="text-xs text-text">Slots (multiclasse)</div>
                          <Select
                            className="mt-1 h-9 px-2 py-1"
                            value={cls.spellcastingProgression ?? 'auto'}
                            onChange={(e) => {
                              const v = e.target.value as 'auto' | 'third'
                              updateCharacter(activeCharacter.id, (c) => ({
                                ...c,
                                classes: c.classes.map((x) =>
                                  x.id === cls.id
                                    ? { ...x, spellcastingProgression: v === 'auto' ? undefined : v }
                                    : x,
                                ),
                              }))
                            }}
                            title="Fighter/Rogue só contam como 1/3 conjurador se forem Cavaleiro Arcano / Trapaceiro Arcano."
                          >
                            <option value="auto">Padrão (sem slots)</option>
                            <option value="third">1/3 conjurador (EK/AT)</option>
                          </Select>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          updateCharacter(activeCharacter.id, (c) => ({
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-textH">Calculadora de conjuração</div>
              <div className="mt-1 text-xs text-text">Calcula bônus de ataque mágico e CD. Truques mostram a escala de dano.</div>
            </div>
            <div className="text-xs text-text">Nível total: {activeCharacterTotalLevel}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-text">Conjurar como</label>
              <Select
                className="mt-1"
                value={effectiveCalcClassId}
                onChange={(e) => setCalcClassId(e.target.value)}
                disabled={disableCalcClassSelect}
              >
                {disableCalcClassSelect ? (
                  <option value="">Adicione uma classe primeiro</option>
                ) : (
                  activeCharacter.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classDisplayName(c)}
                    </option>
                  ))
                )}
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-[color:var(--social-bg)] p-3">
              <div className="text-xs text-text">Resultados</div>
              <div className="mt-1 text-sm text-textH">
                Ataque Mágico: <span className="font-mono">{formatSigned(atk)}</span>
              </div>
              <div className="text-sm text-textH">
                CD (Resistência): <span className="font-mono">{dc}</span>
              </div>
              <div className="mt-2 text-xs text-text">
                {`Dado de dano do truque: x${cantripDiceMultiplier(activeCharacterTotalLevel)} (escala 5e). ATQ/CD não mudam com o círculo.`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
