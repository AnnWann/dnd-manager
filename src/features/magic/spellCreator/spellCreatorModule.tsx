import { useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import type {
  MagicCircleLevel,
  MagicSchool,
} from "../../../models/magic/spells/spellDefinitions"
import type { Spell } from "../../../models/magic/spells/Spell"

const MAGIC_SCHOOLS: { value: MagicSchool; label: string }[] = [
  { value: "abjuration", label: "Abjuração" },
  { value: "conjuration", label: "Conjuração" },
  { value: "divination", label: "Adivinhação" },
  { value: "enchantment", label: "Encantamento" },
  { value: "evocation", label: "Evocação" },
  { value: "illusion", label: "Ilusão" },
  { value: "necromancy", label: "Necromancia" },
  { value: "transmutation", label: "Transmutação" },
]

type SpellSchoolInput = MagicSchool | "other"

function newSpell(): Spell {
  return {
    index: crypto.randomUUID(),
    name: "",
    description: "",
    higherLevelText: "",
    homebrew: true,

    slotLevel: 0,
    school: "evocation",
    classes: [],

    rollMode: [],

    castingTime: {
      value: 1,
      type: "action",
    },

    range: {
      origin: "target",
      distance: 0,
    },

    duration: {
      value: 0,
      unit: "instantaneous",
    },

    concentration: false,
    ritual: false,
    prepared: false,
    components: [],

    targeting: {
      kind: "special",
      targetsSelf: false,
      hasAttackRoll: false,
      hasSavingThrow: false,
      affectsArea: false,
    },

    effects: [],
  }
}

export function SpellCreatorModule() {
  const [spell, setSpell] = useState<Spell>(() => newSpell())
  const [schoolMode, setSchoolMode] = useState<SpellSchoolInput>("evocation")

  const hasDistance =
    spell.range.origin !== "self" && spell.range.origin !== "touch"

  function updateSpell<K extends keyof Spell>(key: K, value: Spell[K]) {
    setSpell((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function updateCastingTime(patch: Partial<Spell["castingTime"]>) {
    setSpell((prev) => ({
      ...prev,
      castingTime: {
        ...prev.castingTime,
        ...patch,
      },
    }))
  }

  function adjustCastingTimeValue(delta: number) {
    setSpell((prev) => ({
      ...prev,
      castingTime: {
        ...prev.castingTime,
        value: Math.max(0, prev.castingTime.value + delta),
      },
    }))
  }

  function updateRange(patch: Partial<Spell["range"]>) {
    setSpell((prev) => {
      const nextRange = {
        ...prev.range,
        ...patch,
      }

      if (nextRange.origin === "self" || nextRange.origin === "touch") {
        nextRange.distance = 0
      }

      return {
        ...prev,
        range: nextRange,
      }
    })
  }

  function adjustRangeDistance(delta: number) {
    setSpell((prev) => ({
      ...prev,
      range: {
        ...prev.range,
        distance: Math.max(0, prev.range.distance + delta),
      },
    }))
  }

  function updateRangeArea(
    patch: Partial<NonNullable<Spell["range"]["area"]>>,
  ) {
    setSpell((prev) => ({
      ...prev,
      range: {
        ...prev.range,
        area: {
          shape: prev.range.area?.shape ?? "circle",
          size: prev.range.area?.size ?? 0,
          ...patch,
        },
      },
    }))
  }

  function clearRangeArea() {
    setSpell((prev) => ({
      ...prev,
      range: {
        ...prev.range,
        area: undefined,
      },
    }))
  }

  function adjustRangeAreaSize(delta: number) {
    setSpell((prev) => ({
      ...prev,
      range: {
        ...prev.range,
        area: {
          shape: prev.range.area?.shape ?? "circle",
          size: Math.max(0, (prev.range.area?.size ?? 0) + delta),
        },
      },
    }))
  }

  function updateDurationValue(value: number) {
    setSpell((prev) => ({
      ...prev,
      duration: {
        ...prev.duration,
        value,
      },
    }))
  }

  function adjustDurationValue(delta: number) {
    setSpell((prev) => ({
      ...prev,
      duration: {
        ...prev.duration,
        value: Math.max(0, prev.duration.value + delta),
      },
    }))
  }

  function updateDurationUnit(unit: Spell["duration"]["unit"]) {
    setSpell((prev) => ({
      ...prev,
      duration: {
        ...prev.duration,
        unit,
      },
    }))
  }

  function toggleComponent(component: "V" | "S" | "M") {
    setSpell((prev) => {
      const hasComponent = prev.components.includes(component)

      return {
        ...prev,
        components: hasComponent
          ? prev.components.filter((c) => c !== component)
          : [...prev.components, component],
      }
    })
  }

  function resetSpell() {
    const nextSpell = newSpell()
    setSpell(nextSpell)
    setSchoolMode(nextSpell.school as MagicSchool)
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">Criar magia</div>
        <div className="mt-1 text-xs text-text">
          Crie uma magia homebrew para usar na mesa.
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3">
          <Input
            value={spell.name}
            onChange={(e) => updateSpell("name", e.target.value)}
            placeholder="Nome da magia"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text">
              Nível
              <select
                className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={spell.slotLevel}
                onChange={(e) =>
                  updateSpell(
                    "slotLevel",
                    Number(e.target.value) as MagicCircleLevel,
                  )
                }
              >
                <option value={0}>Truque</option>
                <option value={1}>1º círculo</option>
                <option value={2}>2º círculo</option>
                <option value={3}>3º círculo</option>
                <option value={4}>4º círculo</option>
                <option value={5}>5º círculo</option>
                <option value={6}>6º círculo</option>
                <option value={7}>7º círculo</option>
                <option value={8}>8º círculo</option>
                <option value={9}>9º círculo</option>
              </select>
            </label>

            <label className="text-xs text-text">
              Escola
              <select
                className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={schoolMode}
                onChange={(e) => {
                  const value = e.target.value as SpellSchoolInput
                  setSchoolMode(value)

                  if (value !== "other") {
                    updateSpell("school", value)
                  } else {
                    updateSpell("school", "")
                  }
                }}
              >
                {MAGIC_SCHOOLS.map((school) => (
                  <option key={school.value} value={school.value}>
                    {school.label}
                  </option>
                ))}

                <option value="other">Outra</option>
              </select>

              {schoolMode === "other" && (
                <Input
                  className="mt-2"
                  value={spell.school}
                  onChange={(e) => updateSpell("school", e.target.value)}
                  placeholder="Digite a escola"
                />
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text">
              Tempo de conjuração
              <div className="flex h-9 overflow-hidden rounded-xl border border-accentBorder bg-bg">
                <button
                  type="button"
                  className="w-10 border-r border-accentBorder text-textH"
                  onClick={() => adjustCastingTimeValue(-1)}
                >
                  -
                </button>

                <Input
                  className="h-full rounded-none border-0 text-center"
                  type="number"
                  min={0}
                  value={spell.castingTime.value}
                  onChange={(e) =>
                    updateCastingTime({ value: Number(e.target.value) })
                  }
                />

                <button
                  type="button"
                  className="w-10 border-l border-accentBorder text-textH"
                  onClick={() => adjustCastingTimeValue(1)}
                >
                  +
                </button>
              </div>
            </label>

            <label className="text-xs text-text">
              Tipo
              <select
                className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={spell.castingTime.type}
                onChange={(e) =>
                  updateCastingTime({
                    type: e.target.value as Spell["castingTime"]["type"],
                  })
                }
              >
                <option value="action">Ação</option>
                <option value="bonusAction">Ação bônus</option>
                <option value="reaction">Reação</option>
                <option value="minute">Minuto</option>
                <option value="hour">Hora</option>
                <option value="special">Especial</option>
              </select>
            </label>
          </div>

          {spell.castingTime.type === "reaction" && (
            <Input
              value={spell.castingTime.reactionWhen ?? ""}
              onChange={(e) =>
                updateCastingTime({ reactionWhen: e.target.value })
              }
              placeholder="Quando a reação pode ser usada?"
            />
          )}

          {spell.castingTime.type === "special" && (
            <Input
              value={spell.castingTime.special ?? ""}
              onChange={(e) =>
                updateCastingTime({ special: e.target.value })
              }
              placeholder="Tempo especial de conjuração"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text">
              Origem do alcance
              <select
                className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={spell.range.origin}
                onChange={(e) =>
                  updateRange({
                    origin: e.target.value as Spell["range"]["origin"],
                  })
                }
              >
                <option value="self">Pessoal</option>
                <option value="touch">Toque</option>
                <option value="point">Ponto</option>
                <option value="target">Alvo</option>
                <option value="ally">Aliado</option>
                <option value="enemy">Inimigo</option>
              </select>
            </label>

            {hasDistance && (
              <label className="text-xs text-text">
                Distância
                <div className="flex h-9 overflow-hidden rounded-xl border border-accentBorder bg-bg">
                  <button
                    type="button"
                    className="w-10 border-r border-accentBorder text-textH"
                    onClick={() => adjustRangeDistance(-1.5)}
                  >
                    -
                  </button>

                  <Input
                    className="h-full rounded-none border-0 text-center"
                    type="number"
                    min={0}
                    step={1.5}
                    value={spell.range.distance}
                    onChange={(e) =>
                      updateRange({ distance: Number(e.target.value) })
                    }
                  />

                  <button
                    type="button"
                    className="w-10 border-l border-accentBorder text-textH"
                    onClick={() => adjustRangeDistance(1.5)}
                  >
                    +
                  </button>
                </div>
              </label>
            )}
          </div>

          <div className="rounded-xl border border-accentBorder bg-bg p-3">
            <label className="flex items-center gap-2 text-xs text-text">
              <input
                type="checkbox"
                checked={Boolean(spell.range.area)}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateRangeArea({ shape: "circle", size: 1.5 })
                  } else {
                    clearRangeArea()
                  }
                }}
              />
              Possui área de efeito
            </label>

            {spell.range.area && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs text-text">
                  Forma da área
                  <select
                    className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                    value={spell.range.area.shape}
                    onChange={(e) =>
                      updateRangeArea({
                        shape: e.target.value as NonNullable<
                          Spell["range"]["area"]
                        >["shape"],
                      })
                    }
                  >
                    <option value="circle">Círculo</option>
                    <option value="square">Quadrado</option>
                    <option value="cone">Cone</option>
                    <option value="line">Linha</option>
                  </select>
                </label>

                <label className="text-xs text-text">
                  Tamanho da área
                  <div className="flex h-9 overflow-hidden rounded-xl border border-accentBorder bg-bg">
                    <button
                      type="button"
                      className="w-10 border-r border-accentBorder text-textH"
                      onClick={() => adjustRangeAreaSize(-1.5)}
                    >
                      -
                    </button>

                    <Input
                      className="h-full rounded-none border-0 text-center"
                      type="number"
                      min={0}
                      step={1.5}
                      value={spell.range.area.size}
                      onChange={(e) =>
                        updateRangeArea({ size: Number(e.target.value) })
                      }
                    />

                    <button
                      type="button"
                      className="w-10 border-l border-accentBorder text-textH"
                      onClick={() => adjustRangeAreaSize(1.5)}
                    >
                      +
                    </button>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text">
              Duração
              <div className="flex h-9 overflow-hidden rounded-xl border border-accentBorder bg-bg">
                <button
                  type="button"
                  className="w-10 border-r border-accentBorder text-textH"
                  onClick={() => adjustDurationValue(-1.5)}
                >
                  -
                </button>

                <Input
                  className="h-full rounded-none border-0 text-center"
                  type="number"
                  min={0}
                  step={1.5}
                  value={spell.duration.value}
                  onChange={(e) =>
                    updateDurationValue(Number(e.target.value))
                  }
                />

                <button
                  type="button"
                  className="w-10 border-l border-accentBorder text-textH"
                  onClick={() => adjustDurationValue(1.5)}
                >
                  +
                </button>
              </div>
            </label>

            <label className="text-xs text-text">
              Unidade
              <select
                className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={spell.duration.unit}
                onChange={(e) =>
                  updateDurationUnit(e.target.value as Spell["duration"]["unit"])
                }
              >
                <option value="instantaneous">Instantânea</option>
                <option value="round">Rodada</option>
                <option value="minute">Minuto</option>
                <option value="hour">Hora</option>
                <option value="day">Dia</option>
                <option value="special">Especial</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-text">
            {(["V", "S", "M"] as const).map((component) => (
              <label key={component} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={spell.components.includes(component)}
                  onChange={() => toggleComponent(component)}
                />
                {component}
              </label>
            ))}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={spell.concentration}
                onChange={(e) =>
                  updateSpell("concentration", e.target.checked)
                }
              />
              Concentração
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={spell.ritual}
                onChange={(e) => updateSpell("ritual", e.target.checked)}
              />
              Ritual
            </label>
          </div>

          {spell.components.includes("M") && (
            <Input
              value={spell.material ?? ""}
              onChange={(e) => updateSpell("material", e.target.value)}
              placeholder="Material"
            />
          )}

          <textarea
            className="min-h-32 rounded-xl border border-accentBorder bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
            value={spell.description}
            onChange={(e) => updateSpell("description", e.target.value)}
            placeholder="Descrição da magia"
          />

          <textarea
            className="min-h-24 rounded-xl border border-accentBorder bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
            value={spell.higherLevelText}
            onChange={(e) => updateSpell("higherLevelText", e.target.value)}
            placeholder="Em níveis superiores"
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={resetSpell}>
              Limpar
            </Button>

            <Button variant="primary" onClick={() => console.log(spell)}>
              Salvar magia
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}