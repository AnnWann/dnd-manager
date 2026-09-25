import { Select as SharedSelect } from "../../../components/ui/Select"
import { useEffect, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import type {
  MagicCircleLevel,
  MagicSchool,
} from "../../../models/magic/spells/spellDefinitions"
import type { Spell, SpellDamageComponent, SpellNumericScaling, SpellResolution } from "../../../models/magic/spells/Spell"
import type { DieSides } from "../../../models/dice/Die"
import type { Attribute } from "../../../models/sheet/Attribute"
import { MAGIC_SCHOOLS, SPELL_CLASS_OPTIONS } from "../../../contexts/consts"
import type { ClassName } from "../../../models/sheet/Class"

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
    resolution: {
      roll: { type: "none" },
      damage: [],
    },

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

type Props = {
  saveSpell: (spell: Spell) => void
  editingSpell?: Spell | null
}

export function SpellCreatorModule({
  saveSpell,
  editingSpell = null
}: Props
) {
  const [spell, setSpell] = useState<Spell>(() => editingSpell ?? newSpell())

  function isKnownSchool(school: unknown): school is MagicSchool {
  return MAGIC_SCHOOLS.some((entry) => entry.value === school)
  }

  const [schoolMode, setSchoolMode] = useState<SpellSchoolInput>(
    isKnownSchool(editingSpell?.school) ? editingSpell.school : "evocation",
  )

  useEffect(() => {
    const nextSpell = editingSpell ?? newSpell()

    setSpell(nextSpell)
    setSchoolMode(
      isKnownSchool(nextSpell.school) ? nextSpell.school : "other",
    )
  }, [editingSpell])

  const hasDistance =
    spell.range.origin !== "self" && spell.range.origin !== "touch"

  function updateSpell<K extends keyof Spell>(key: K, value: Spell[K]) {
    setSpell((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function currentResolution(value: Spell = spell): SpellResolution {
    if (value.resolution) return value.resolution
    return {
      roll: value.targeting.hasAttackRoll
        ? { type: "attack" }
        : value.targeting.hasSavingThrow && value.targeting.savingThrowAttribute
          ? {
              type: "save",
              attribute: value.targeting.savingThrowAttribute,
              onSuccess: "none",
            }
          : { type: "none" },
      damage: value.damageDice
        ? [{
            id: "legacy-damage",
            label: "Dano",
            dice: { ...value.damageDice },
            appliesOn: value.targeting.hasAttackRoll
              ? "hit"
              : value.targeting.hasSavingThrow
                ? "failed-save"
                : "always",
            critical: value.targeting.hasAttackRoll,
          }]
        : [],
    }
  }

  function updateResolution(next: SpellResolution) {
    setSpell((prev) => {
      const firstDamage = next.damage?.[0]
      return {
        ...prev,
        resolution: next,
        damageDice: firstDamage
          ? {
              quantity: Math.max(0, Math.trunc(firstDamage.dice.quantity)),
              sides: firstDamage.dice.sides,
            }
          : undefined,
        targeting: {
          ...prev.targeting,
          hasAttackRoll: next.roll.type === "attack",
          hasSavingThrow: next.roll.type === "save",
          savingThrowAttribute:
            next.roll.type === "save"
              ? next.roll.attribute
              : undefined,
        },
        rollMode: next.roll.type === "attack"
          ? ["attack"]
          : next.roll.type === "save"
            ? ["save"]
            : [],
      }
    })
  }

  function setResolutionRollType(type: SpellResolution["roll"]["type"]) {
    const current = currentResolution()
    updateResolution({
      ...current,
      roll: type === "attack"
        ? { type: "attack", count: { base: 1 } }
        : type === "save"
          ? { type: "save", attribute: "dex", onSuccess: "none" }
          : { type: "none" },
    })
  }

  function updateAttackCount(base: number) {
    const current = currentResolution()
    if (current.roll.type !== "attack") return
    updateResolution({
      ...current,
      roll: {
        ...current.roll,
        count: {
          ...current.roll.count,
          base: Math.max(1, Math.trunc(base) || 1),
        },
      },
    })
  }

  function updateAttackScaling(scaling: SpellNumericScaling | undefined) {
    const current = currentResolution()
    if (current.roll.type !== "attack") return
    updateResolution({
      ...current,
      roll: {
        ...current.roll,
        count: {
          base: current.roll.count?.base ?? 1,
          scaling,
        },
      },
    })
  }

  function updateSave(patch: Partial<Extract<SpellResolution["roll"], { type: "save" }>>) {
    const current = currentResolution()
    if (current.roll.type !== "save") return
    updateResolution({
      ...current,
      roll: { ...current.roll, ...patch },
    })
  }

  function setDamageComponents(damage: SpellDamageComponent[]) {
    updateResolution({ ...currentResolution(), damage })
  }

  function addDamageComponent() {
    const current = currentResolution()
    setDamageComponents([
      ...(current.damage ?? []),
      {
        id: crypto.randomUUID(),
        label: "Dano",
        dice: { quantity: 1, sides: "d6" },
        appliesOn: current.roll.type === "attack"
          ? "hit"
          : current.roll.type === "save"
            ? "failed-save"
            : "always",
        critical: current.roll.type === "attack",
      },
    ])
  }

  function updateDamageComponent(index: number, patch: Partial<SpellDamageComponent>) {
    const damage = [...(currentResolution().damage ?? [])]
    const current = damage[index]
    if (!current) return
    damage[index] = { ...current, ...patch }
    setDamageComponents(damage)
  }

  function removeDamageComponent(index: number) {
    setDamageComponents(
      (currentResolution().damage ?? []).filter((_, candidate) => candidate !== index),
    )
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

  function toggleClass(spell: Spell, className: ClassName): ClassName[] {
    return spell.classes.includes(className)
      ? spell.classes.filter((entry) => entry !== className)
      : [...spell.classes, className]
  }

  const resolution = currentResolution()

  return (
    <Card>

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
              <SharedSelect
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
              </SharedSelect>
            </label>

            <label className="text-xs text-text">
              Escola
              <SharedSelect
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
              </SharedSelect>

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

          <div className="rounded-xl border border-accentBorder bg-bg p-3">
            <div className="text-xs font-medium text-textH">
              Classes
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-text">
              {SPELL_CLASS_OPTIONS.map((className) => (
                <label key={className.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={spell.classes.includes(className.value)}
                    onChange={() =>
                      updateSpell("classes", toggleClass(spell, className.value))
                    }
                  />
                  {className.label}
                </label>
              ))}
            </div>
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
              <SharedSelect
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
              </SharedSelect>
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
              <SharedSelect
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
              </SharedSelect>
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
                  <SharedSelect
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
                  </SharedSelect>
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
              <SharedSelect
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
              </SharedSelect>
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

          <section className="grid gap-3 rounded-xl border border-accentBorder bg-bg p-3">
            <div>
              <div className="text-xs font-semibold text-textH">Resolução mecânica</div>
              <p className="mt-1 text-[11px] text-textMuted">
                Estrutura usada pelo servidor para ataque, CD, dano, crítico e escalonamento.
              </p>
            </div>

            <label className="grid gap-1 text-xs text-text">
              Tipo de resolução
              <SharedSelect
                className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text"
                value={resolution.roll.type}
                onChange={(event) =>
                  setResolutionRollType(
                    event.target.value as SpellResolution["roll"]["type"],
                  )
                }
              >
                <option value="none">Sem ataque/resistência</option>
                <option value="attack">Jogada de ataque</option>
                <option value="save">Teste de resistência</option>
              </SharedSelect>
            </label>

            {resolution.roll.type === "attack" ? (
              <div className="grid gap-3 rounded-lg border border-border bg-bg-subtle p-3">
                <label className="grid gap-1 text-xs text-text">
                  Quantidade base de ataques/projéteis
                  <Input
                    type="number"
                    min={1}
                    value={resolution.roll.type === "attack"
                      ? resolution.roll.count?.base ?? 1
                      : 1}
                    onChange={(event) => updateAttackCount(Number(event.target.value))}
                  />
                </label>
                <ScalingEditor
                  label="Escalonamento da quantidade de ataques"
                  scaling={resolution.roll.type === "attack"
                    ? resolution.roll.count?.scaling
                    : undefined}
                  defaultStartLevel={spell.slotLevel}
                  onChange={updateAttackScaling}
                />
              </div>
            ) : null}

            {resolution.roll.type === "save" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-text">
                  Atributo da resistência
                  <SharedSelect
                    className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text"
                    value={resolution.roll.type === "save"
                      ? resolution.roll.attribute
                      : "dex"}
                    onChange={(event) =>
                      updateSave({ attribute: event.target.value as Attribute })
                    }
                  >
                    <option value="str">FOR</option>
                    <option value="dex">DES</option>
                    <option value="con">CON</option>
                    <option value="int">INT</option>
                    <option value="wis">SAB</option>
                    <option value="cha">CAR</option>
                  </SharedSelect>
                </label>
                <label className="grid gap-1 text-xs text-text">
                  Em um sucesso
                  <SharedSelect
                    className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text"
                    value={resolution.roll.type === "save"
                      ? resolution.roll.onSuccess
                      : "none"}
                    onChange={(event) =>
                      updateSave({
                        onSuccess: event.target.value as "none" | "half" | "full",
                      })
                    }
                  >
                    <option value="none">Sem dano/efeito</option>
                    <option value="half">Metade do dano</option>
                    <option value="full">Dano completo</option>
                  </SharedSelect>
                </label>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-textH">Componentes de dano</div>
              <Button size="sm" variant="secondary" onClick={addDamageComponent}>
                Adicionar dano
              </Button>
            </div>

            {(resolution.damage ?? []).map((damage, index) => (
              <div key={damage.id} className="grid gap-3 rounded-lg border border-border bg-bg-subtle p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={damage.label ?? ""}
                    placeholder="Rótulo, ex.: Dano de fogo"
                    onChange={(event) =>
                      updateDamageComponent(index, { label: event.target.value })
                    }
                  />
                  <Input
                    value={damage.damageType ?? ""}
                    placeholder="Tipo de dano, ex.: fire"
                    onChange={(event) =>
                      updateDamageComponent(index, { damageType: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  <label className="grid gap-1 text-xs text-text">
                    Dados
                    <Input
                      type="number"
                      min={0}
                      value={damage.dice.quantity}
                      onChange={(event) =>
                        updateDamageComponent(index, {
                          dice: {
                            ...damage.dice,
                            quantity: Math.max(0, Number(event.target.value)),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-text">
                    Dado
                    <SharedSelect
                      className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text"
                      value={damage.dice.sides}
                      onChange={(event) =>
                        updateDamageComponent(index, {
                          dice: {
                            ...damage.dice,
                            sides: event.target.value as DieSides,
                          },
                        })
                      }
                    >
                      {(["d2", "d3", "d4", "d6", "d8", "d10", "d12", "d20", "d100"] as DieSides[]).map((side) => (
                        <option key={side} value={side}>{side}</option>
                      ))}
                    </SharedSelect>
                  </label>
                  <label className="grid gap-1 text-xs text-text">
                    Bônus fixo
                    <Input
                      type="number"
                      value={damage.flat ?? 0}
                      onChange={(event) =>
                        updateDamageComponent(index, { flat: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-text">
                    Aplicação
                    <SharedSelect
                      className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text"
                      value={damage.appliesOn}
                      onChange={(event) =>
                        updateDamageComponent(index, {
                          appliesOn: event.target.value as SpellDamageComponent["appliesOn"],
                        })
                      }
                    >
                      <option value="hit">Ao acertar</option>
                      <option value="failed-save">Falha na resistência</option>
                      <option value="successful-save">Sucesso na resistência</option>
                      <option value="always">Sempre</option>
                    </SharedSelect>
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs text-text">
                  <input
                    type="checkbox"
                    checked={damage.critical ?? damage.appliesOn === "hit"}
                    onChange={(event) =>
                      updateDamageComponent(index, { critical: event.target.checked })
                    }
                  />
                  Dobra os dados em crítico
                </label>

                <ScalingEditor
                  label="Escalonamento dos dados"
                  scaling={damage.diceScaling}
                  defaultStartLevel={spell.slotLevel}
                  onChange={(scaling) =>
                    updateDamageComponent(index, { diceScaling: scaling })
                  }
                />

                <div className="flex justify-end">
                  <Button size="sm" variant="danger" onClick={() => removeDamageComponent(index)}>
                    Remover dano
                  </Button>
                </div>
              </div>
            ))}
          </section>

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

            <Button variant="primary" onClick={() => {
              saveSpell(spell);
              resetSpell()
            }}>
              {editingSpell ? "Salvar alterações" : "Salvar magia"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ScalingEditor({
  label,
  scaling,
  defaultStartLevel,
  onChange,
}: {
  label: string
  scaling?: SpellNumericScaling
  defaultStartLevel: number
  onChange: (scaling: SpellNumericScaling | undefined) => void
}) {
  const mode = scaling?.type ?? "none"

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-bg p-2">
      <label className="grid gap-1 text-[11px] text-textMuted">
        {label}
        <SharedSelect
          className="h-8 rounded-lg border border-border bg-bg px-2 text-xs text-text"
          value={mode}
          onChange={(event) => {
            const nextMode = event.target.value
            if (nextMode === "none") {
              onChange(undefined)
            } else if (nextMode === "step") {
              onChange({
                type: "step",
                source: defaultStartLevel === 0 ? "character-level" : "slot-level",
                startLevel: defaultStartLevel,
                interval: 1,
                amountPerStep: 1,
              })
            } else {
              onChange({
                type: "thresholds",
                source: defaultStartLevel === 0 ? "character-level" : "slot-level",
                thresholds: defaultStartLevel === 0
                  ? [{ level: 5, amount: 1 }, { level: 11, amount: 1 }, { level: 17, amount: 1 }]
                  : [],
              })
            }
          }}
        >
          <option value="none">Sem escalonamento</option>
          <option value="step">A cada N níveis</option>
          <option value="thresholds">Níveis específicos</option>
        </SharedSelect>
      </label>

      {scaling?.type === "step" ? (
        <div className="grid gap-2 sm:grid-cols-4">
          <ScalingSourceSelect
            value={scaling.source}
            onChange={(source) => onChange({ ...scaling, source })}
          />
          <label className="grid gap-1 text-[11px] text-textMuted">
            Nível inicial
            <Input
              type="number"
              min={0}
              value={scaling.startLevel}
              onChange={(event) =>
                onChange({ ...scaling, startLevel: Math.max(0, Number(event.target.value)) })
              }
            />
          </label>
          <label className="grid gap-1 text-[11px] text-textMuted">
            A cada N níveis
            <Input
              type="number"
              min={1}
              value={scaling.interval}
              onChange={(event) =>
                onChange({ ...scaling, interval: Math.max(1, Number(event.target.value)) })
              }
            />
          </label>
          <label className="grid gap-1 text-[11px] text-textMuted">
            Aumento por etapa
            <Input
              type="number"
              value={scaling.amountPerStep}
              onChange={(event) =>
                onChange({ ...scaling, amountPerStep: Number(event.target.value) })
              }
            />
          </label>
        </div>
      ) : null}

      {scaling?.type === "thresholds" ? (
        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <ScalingSourceSelect
            value={scaling.source}
            onChange={(source) => onChange({ ...scaling, source })}
          />
          <label className="grid gap-1 text-[11px] text-textMuted">
            Limiares (nível:+aumento)
            <Input
              value={formatThresholds(scaling.thresholds)}
              placeholder="5:+1, 11:+1, 17:+1"
              onChange={(event) =>
                onChange({
                  ...scaling,
                  thresholds: parseThresholds(event.target.value),
                })
              }
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}

function ScalingSourceSelect({
  value,
  onChange,
}: {
  value: SpellNumericScaling["source"]
  onChange: (source: SpellNumericScaling["source"]) => void
}) {
  return (
    <label className="grid gap-1 text-[11px] text-textMuted">
      Escala por
      <SharedSelect
        className="h-9 rounded-xl border border-border bg-bg px-2 text-xs text-text"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as SpellNumericScaling["source"])
        }
      >
        <option value="slot-level">Nível da conjuração</option>
        <option value="character-level">Nível do personagem</option>
      </SharedSelect>
    </label>
  )
}

function parseThresholds(value: string): Array<{ level: number; amount: number }> {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [levelText, amountText] = entry.split(":")
      return {
        level: Math.max(0, Math.trunc(Number(levelText))),
        amount: Math.trunc(Number(amountText)),
      }
    })
    .filter((entry) => Number.isFinite(entry.level) && Number.isFinite(entry.amount))
    .sort((left, right) => left.level - right.level)
}

function formatThresholds(thresholds: Array<{ level: number; amount: number }>): string {
  return thresholds
    .map((entry) => `${entry.level}:${entry.amount >= 0 ? "+" : ""}${entry.amount}`)
    .join(", ")
}
