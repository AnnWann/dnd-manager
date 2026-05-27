import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { clampInt } from "../../../lib/numberFormat"
import { ABILITIES } from "../../../lib/rules"
import { CLASS_OPTIONS, classLabel } from "../../../lib/spellLabels"
import type { Attribute, Character } from "../../../types"


type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
  abilityShort: (ability: Attribute) => string
  addClassToActive: (classIndex: string) => void
}

export function Class({ character, updateCharacter, abilityShort, addClassToActive }: Props) {
  if (character.type !== 'pc') return null

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
                    updateCharacter(character.id, (c) => ({
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

                {(cls.classIndex === 'fighter' || cls.classIndex === 'rogue') ? (
                  <div className="mt-2">
                    <div className="text-xs text-text">Slots (multiclasse)</div>
                    <Select
                      className="mt-1 h-9 px-2 py-1"
                      value={cls.spellcastingProgression ?? 'auto'}
                      onChange={(e) => {
                        const v = e.target.value as 'auto' | 'third'
                        updateCharacter(character.id, (c) => ({
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