import { Select as SharedSelect } from "../../../components/ui/Select"
import { ClipboardCopy, FileJson, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { AttackRidersEditor } from "../../characters/abilities/AttackRidersEditor"
import { DAMAGE_TYPE_OPTIONS } from "../../../models/combat/Damage"
import { Textarea } from "../../../components/ui/Textarea"
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
  submitLabel?: string
}

export function SpellCreatorModule({
  saveSpell,
  editingSpell = null,
  submitLabel,
}: Props
) {
  const [spell, setSpell] = useState<Spell>(() => editingSpell ?? newSpell())
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState("")
  const [jsonError, setJsonError] = useState("")
  const [copyFeedback, setCopyFeedback] = useState("")

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
    setJsonOpen(false)
    setJsonText("")
    setJsonError("")
    setCopyFeedback("")
  }, [editingSpell])

  function openJsonEditor() {
    setJsonText(JSON.stringify(spellForJsonEditor(spell), null, 2))
    setJsonError("")
    setJsonOpen(true)
  }

  async function copyAiTemplate() {
    const template = buildSpellAiTemplate()
    try {
      await copyTextToClipboard(template)
      setCopyFeedback("Estrutura copiada.")
      window.setTimeout(() => setCopyFeedback(""), 1800)
    } catch {
      setCopyFeedback("Não foi possível copiar.")
    }
  }

  function applyJson() {
    try {
      const imported = parseSpellJson(jsonText, spell)
      setSpell(imported)
      setSchoolMode(
        isKnownSchool(imported.school) ? imported.school : "other",
      )
      setJsonError("")
      setJsonOpen(false)
    } catch (error) {
      setJsonError(
        error instanceof Error
          ? error.message
          : "Não foi possível interpretar o JSON da magia.",
      )
    }
  }

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
        damageDice: firstDamage?.dice
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
        ? { type: "attack" }
        : type === "save"
          ? { type: "save", attribute: "dex", onSuccess: "none" }
          : { type: "none" },
    })
  }

  function updateInstanceCount(base: number) {
    const current = currentResolution()
    updateResolution({
      ...current,
      instances: {
        ...current.instances,
        base: Math.max(1, Math.trunc(base) || 1),
      },
    })
  }

  function updateInstanceScaling(scaling: SpellNumericScaling | undefined) {
    const current = currentResolution()
    updateResolution({
      ...current,
      instances: {
        base: current.instances?.base ?? 1,
        scaling,
      },
    })
  }

  function updateSave(patch: Partial<Omit<Extract<SpellResolution["roll"], { type: "save" }>, "type">>) {
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
    const nextSpell = editingSpell ?? newSpell()
    setSpell(nextSpell)
    setSchoolMode(
      isKnownSchool(nextSpell.school) ? nextSpell.school : "other",
    )
  }

  function toggleClass(spell: Spell, className: ClassName): ClassName[] {
    return spell.classes.includes(className)
      ? spell.classes.filter((entry) => entry !== className)
      : [...spell.classes, className]
  }

  const resolution = currentResolution()

  return (
    <>
    <Card>

      <CardContent>
        <div className="grid gap-3">
          <section className="rounded-xl border border-border bg-bg-subtle p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-textH">
                  Entrada por JSON
                </div>
                <p className="mt-1 text-[11px] leading-5 text-textMuted">
                  Cole uma magia estruturada para preencher este formulário ou copie
                  um modelo completo para gerar a magia com IA.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={openJsonEditor}>
                  <FileJson className="h-4 w-4" />
                  Editar via JSON
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void copyAiTemplate()}>
                  <ClipboardCopy className="h-4 w-4" />
                  Copiar estrutura para IA
                </Button>
              </div>
            </div>
            {copyFeedback ? (
              <div className="mt-2 text-[11px] font-medium text-accent">
                {copyFeedback}
              </div>
            ) : null}
          </section>

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

            {resolution.roll.type !== "save" ? (
              <div className="grid gap-3 rounded-lg border border-border bg-bg-subtle p-3">
                <label className="grid gap-1 text-xs text-text">
                  Quantidade base de instâncias
                  <Input
                    type="number"
                    min={1}
                    value={resolution.instances?.base ?? 1}
                    onChange={(event) => updateInstanceCount(Number(event.target.value))}
                  />
                </label>
                <p className="text-[10px] leading-4 text-textMuted">
                  Use para ataques/projéteis independentes ou efeitos repetidos, como raios, feixes ou dardos.
                </p>
                <ScalingEditor
                  label="Escalonamento da quantidade de instâncias"
                  scaling={resolution.instances?.scaling}
                  defaultStartLevel={spell.slotLevel}
                  onChange={updateInstanceScaling}
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
                      value={damage.dice?.quantity ?? 0}
                      onChange={(event) => {
                        const quantity = Math.max(0, Number(event.target.value))
                        updateDamageComponent(index, {
                          dice: quantity > 0
                            ? {
                                quantity,
                                sides: damage.dice?.sides ?? "d6",
                              }
                            : undefined,
                        })
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-text">
                    Dado
                    <SharedSelect
                      className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text"
                      value={damage.dice?.sides ?? "d6"}
                      disabled={!damage.dice}
                      onChange={(event) =>
                        updateDamageComponent(index, {
                          dice: damage.dice
                            ? {
                                ...damage.dice,
                                sides: event.target.value as DieSides,
                              }
                            : undefined,
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

                <div className="flex flex-wrap gap-4">
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
                  <label className="flex items-center gap-2 text-xs text-text">
                    <input
                      type="checkbox"
                      checked={Boolean(damage.addCastingModifier)}
                      onChange={(event) =>
                        updateDamageComponent(index, {
                          addCastingModifier: event.target.checked,
                        })
                      }
                    />
                    Soma o modificador de conjuração
                  </label>
                </div>

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

          <section className="grid gap-3 rounded-xl border border-accentBorder bg-bg p-3">
            <h3 className="text-xs font-semibold text-textH">Tipos de dano disponíveis na conjuração</h3>
            <p className="text-[11px] text-textMuted">Marque os tipos que o jogador pode escolher ao conjurar. O escolhido substitui o tipo dos componentes de dano direto da magia.</p>
            <div className="flex flex-wrap gap-2">
              {DAMAGE_TYPE_OPTIONS.map(option => <label key={option.value} className="flex items-center gap-1.5 text-xs text-textH">
                <input type="checkbox" checked={(spell.castDamageTypeChoices ?? []).includes(option.value)}
                  onChange={event => updateSpell("castDamageTypeChoices", event.target.checked
                    ? [...(spell.castDamageTypeChoices ?? []), option.value]
                    : (spell.castDamageTypeChoices ?? []).filter(type => type !== option.value))} />
                {option.label}
              </label>)}
            </div>
          </section>
          <AttackRidersEditor
            defaultScope="spell"
            riders={spell.onCastAttackRiders ?? []}
            onChange={onCastAttackRiders => updateSpell("onCastAttackRiders", onCastAttackRiders)}
          />
          {(spell.onCastAttackRiders?.length ?? 0) > 0 && !spell.concentration ? (
            <p className="text-xs text-danger">Riders de magias exigem concentração enquanto o efeito estiver ativo.</p>
          ) : null}

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
              {editingSpell ? "Desfazer alterações" : "Limpar"}
            </Button>

            <Button variant="primary" onClick={() => {
              saveSpell(spell);
              resetSpell()
            }}>
              {submitLabel ?? (editingSpell ? "Salvar alterações" : "Salvar magia")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {jsonOpen ? (
      <SpellJsonEditorModal
        value={jsonText}
        error={jsonError}
        template={buildSpellAiTemplate()}
        onChange={(value) => {
          setJsonText(value)
          if (jsonError) setJsonError("")
        }}
        onUseTemplate={() => {
          setJsonText(buildSpellAiTemplate())
          setJsonError("")
        }}
        onCopyTemplate={() => void copyAiTemplate()}
        onApply={applyJson}
        onClose={() => {
          setJsonOpen(false)
          setJsonError("")
        }}
      />
    ) : null}
    </>
  )
}

function SpellJsonEditorModal({
  value,
  error,
  template,
  onChange,
  onUseTemplate,
  onCopyTemplate,
  onApply,
  onClose,
}: {
  value: string
  error: string
  template: string
  onChange: (value: string) => void
  onUseTemplate: () => void
  onCopyTemplate: () => void
  onApply: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section className="grid max-h-[94dvh] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-textH">
              Magia por JSON
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              O JSON substitui os campos do formulário atual. O ID interno da magia
              é preservado para evitar duplicatas acidentais.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-2">
          <section className="grid content-start gap-2">
            <div>
              <h3 className="text-sm font-semibold text-textH">JSON da magia</h3>
              <p className="mt-1 text-xs text-textMuted">
                Cole aqui a resposta da IA ou edite diretamente a estrutura atual.
              </p>
            </div>
            <Textarea
              className="min-h-[520px] resize-y font-mono text-xs leading-5"
              value={value}
              invalid={Boolean(error)}
              spellCheck={false}
              onChange={(event) => onChange(event.target.value)}
            />
            {error ? (
              <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            ) : null}
          </section>

          <section className="grid content-start gap-2">
            <div>
              <h3 className="text-sm font-semibold text-textH">
                Estrutura para IA
              </h3>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                O modelo inclui os campos mecânicos usados pelo servidor, inclusive
                ataque, resistência, dano, crítico e escalonamento.
              </p>
            </div>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg p-3 font-mono text-[11px] leading-5 text-text">
              {template}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={onCopyTemplate}>
                <ClipboardCopy className="h-4 w-4" />
                Copiar estrutura
              </Button>
              <Button size="sm" variant="secondary" onClick={onUseTemplate}>
                Usar modelo no editor
              </Button>
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!value.trim()} onClick={onApply}>
            Aplicar JSON ao formulário
          </Button>
        </footer>
      </section>
    </div>
  )
}

function spellForJsonEditor(spell: Spell): Record<string, unknown> {
  const {
    index: _index,
    homebrew: _homebrew,
    damageDice: _legacyDamage,
    ...editable
  } = spell
  return editable
}

function buildSpellAiTemplate(): string {
  return JSON.stringify(
    {
      _aiGuide: [
        "Retorne apenas um objeto JSON compatível com esta estrutura.",
        "slotLevel vai de 0 a 9; 0 representa truque.",
        "school usa abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy ou transmutation.",
        "classes aceita artificer, barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock e wizard.",
        "resolution.roll.type deve ser none, attack ou save. Em save informe attribute e onSuccess.",
        "damage[].appliesOn aceita hit, failed-save, successful-save ou always.",
        "Para truques, escalonamento normalmente usa source character-level e thresholds 5, 11 e 17.",
        "Para magias que escalam por espaço, use source slot-level.",
        "Não inclua index nem homebrew; o sistema controla esses campos.",
      ],
      name: "Nome da magia",
      description: "Descrição completa da magia.",
      higherLevelText: "Texto de níveis superiores, ou string vazia.",
      displayName: "Nome opcional exibido",
      headcanon: "",
      slotLevel: 1,
      school: "evocation",
      classes: ["wizard", "sorcerer"],
      castingTime: {
        value: 1,
        type: "action",
      },
      range: {
        origin: "target",
        distance: 18,
        area: {
          shape: "circle",
          size: 6,
        },
      },
      duration: {
        value: 0,
        unit: "instantaneous",
      },
      concentration: false,
      ritual: false,
      components: ["V", "S", "M"],
      material: "Componente material opcional.",
      resolution: {
        roll: {
          type: "save",
          attribute: "dex",
          onSuccess: "half",
        },
        instances: {
          base: 1,
        },
        damage: [
          {
            id: "dano-principal",
            label: "Dano",
            damageType: "fire",
            dice: {
              quantity: 3,
              sides: "d6",
            },
            flat: 0,
            addCastingModifier: false,
            appliesOn: "failed-save",
            critical: false,
            diceScaling: {
              type: "step",
              source: "slot-level",
              startLevel: 1,
              interval: 1,
              amountPerStep: 1,
            },
          },
        ],
      },
      targeting: {
        kind: "area",
        targetsSelf: false,
        targetCount: 1,
        canTargetMoreAtHigherLevels: false,
        hasAttackRoll: false,
        hasSavingThrow: true,
        savingThrowAttribute: "dex",
        affectsArea: true,
        areaShape: "circle",
        areaSize: 6,
      },
      effects: [],
    },
    null,
    2,
  )
}

function parseSpellJson(text: string, current: Spell): Spell {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error("O conteúdo não é um JSON válido.")
  }
  if (!isRecord(parsed)) {
    throw new Error("A magia precisa ser um objeto JSON.")
  }

  const base = newSpell()
  const name = stringField(parsed.name, "name", true)
  const slotLevel = integerInRange(parsed.slotLevel, "slotLevel", 0, 9)
  const school = stringField(parsed.school, "school", true)
  const classes = stringArray(parsed.classes, "classes").filter((className) =>
    SPELL_CLASS_OPTIONS.some((entry) => entry.value === className),
  ) as ClassName[]

  const castingTime = parseCastingTime(parsed.castingTime, base.castingTime)
  const range = parseRange(parsed.range, base.range)
  const duration = parseDuration(parsed.duration, base.duration)
  const components = stringArray(parsed.components, "components").filter(
    (entry): entry is "V" | "S" | "M" =>
      entry === "V" || entry === "S" || entry === "M",
  )
  const resolution = parseResolution(parsed.resolution)
  const firstDamage = resolution.damage?.[0]
  const targeting = buildTargetingFromJson(parsed.targeting, resolution, range)

  return {
    ...base,
    index: current.index,
    homebrew: current.homebrew,
    rebalanced: current.rebalanced,
    name,
    description: optionalString(parsed.description) ?? "",
    higherLevelText: optionalString(parsed.higherLevelText) ?? "",
    displayName: optionalString(parsed.displayName),
    headcanon: optionalString(parsed.headcanon),
    slotLevel: slotLevel as MagicCircleLevel,
    school,
    classes,
    castingTime,
    range,
    duration,
    concentration: Boolean(parsed.concentration),
    ritual: Boolean(parsed.ritual),
    components,
    material: components.includes("M")
      ? optionalString(parsed.material)
      : undefined,
    resourceCost: parseResourceCost(parsed.resourceCost),
    castDamageTypeChoices: Array.isArray(parsed.castDamageTypeChoices)
      ? DAMAGE_TYPE_OPTIONS.filter(option => parsed.castDamageTypeChoices.includes(option.value)).map(option => option.value)
      : [],
    onCastAttackRiders: Array.isArray(parsed.onCastAttackRiders) ? structuredClone(parsed.onCastAttackRiders) as Spell["onCastAttackRiders"] : [],
    resolution,
    damageDice: firstDamage?.dice
      ? {
          quantity: Math.max(0, Math.trunc(firstDamage.dice.quantity)),
          sides: firstDamage.dice.sides,
        }
      : undefined,
    rollMode:
      resolution.roll.type === "attack"
        ? ["attack"]
        : resolution.roll.type === "save"
          ? ["save"]
          : [],
    targeting,
    effects: Array.isArray(parsed.effects)
      ? structuredClone(parsed.effects) as Spell["effects"]
      : [],
  }
}

function parseCastingTime(
  value: unknown,
  fallback: Spell["castingTime"],
): Spell["castingTime"] {
  if (!isRecord(value)) return fallback
  const allowed = ["action", "bonusAction", "reaction", "minute", "hour", "special"]
  const type = typeof value.type === "string" && allowed.includes(value.type)
    ? value.type as Spell["castingTime"]["type"]
    : fallback.type
  return {
    value: Math.max(0, finiteNumber(value.value, fallback.value)),
    type,
    reactionWhen: type === "reaction" ? optionalString(value.reactionWhen) : undefined,
    special: type === "special" ? optionalString(value.special) : undefined,
  }
}

function parseRange(value: unknown, fallback: Spell["range"]): Spell["range"] {
  if (!isRecord(value)) return fallback
  const origins = ["self", "touch", "point", "target", "ally", "enemy"]
  const origin =
    typeof value.origin === "string" && origins.includes(value.origin)
      ? value.origin as Spell["range"]["origin"]
      : fallback.origin
  const area = isRecord(value.area)
    ? {
        shape: parseAreaShape(value.area.shape),
        size: Math.max(0, finiteNumber(value.area.size, 0)),
      }
    : undefined
  return {
    origin,
    distance:
      origin === "self" || origin === "touch"
        ? 0
        : Math.max(0, finiteNumber(value.distance, fallback.distance)),
    area,
  }
}

function parseDuration(
  value: unknown,
  fallback: Spell["duration"],
): Spell["duration"] {
  if (!isRecord(value)) return fallback
  const units = [
    "instantaneous",
    "turn",
    "round",
    "minute",
    "hour",
    "day",
    "special",
    "untilDispelled",
    "short rest",
    "long rest",
    "permanent",
  ]
  const unit =
    typeof value.unit === "string" && units.includes(value.unit)
      ? value.unit as Spell["duration"]["unit"]
      : fallback.unit
  return {
    value: Math.max(0, finiteNumber(value.value, fallback.value)),
    unit,
  }
}

function parseResolution(value: unknown): SpellResolution {
  if (!isRecord(value)) return { roll: { type: "none" }, damage: [] }

  const rollRecord = isRecord(value.roll) ? value.roll : {}
  const rollType =
    rollRecord.type === "attack" || rollRecord.type === "save"
      ? rollRecord.type
      : "none"

  const roll: SpellResolution["roll"] =
    rollType === "attack"
      ? { type: "attack" }
      : rollType === "save"
        ? {
            type: "save",
            attribute: parseAttribute(rollRecord.attribute),
            onSuccess:
              rollRecord.onSuccess === "half" || rollRecord.onSuccess === "full"
                ? rollRecord.onSuccess
                : "none",
          }
        : { type: "none" }

  const damage = Array.isArray(value.damage)
    ? value.damage.map((entry, index) => parseDamage(entry, index, roll.type))
    : []

  const instances = isRecord(value.instances)
    ? {
        base: Math.max(1, Math.trunc(finiteNumber(value.instances.base, 1))),
        scaling: parseScaling(value.instances.scaling),
      }
    : undefined

  return {
    roll,
    instances,
    damage,
  }
}

function parseDamage(
  value: unknown,
  index: number,
  rollType: SpellResolution["roll"]["type"],
): SpellDamageComponent {
  if (!isRecord(value)) {
    throw new Error(`resolution.damage[${index}] precisa ser um objeto.`)
  }

  const diceRecord = isRecord(value.dice) ? value.dice : undefined
  const quantity = diceRecord
    ? Math.max(0, Math.trunc(finiteNumber(diceRecord.quantity, 0)))
    : 0
  const sides = diceRecord ? parseDieSides(diceRecord.sides) : undefined
  const appliesOnValues = ["hit", "failed-save", "successful-save", "always"]
  const fallbackAppliesOn =
    rollType === "attack"
      ? "hit"
      : rollType === "save"
        ? "failed-save"
        : "always"
  const appliesOn =
    typeof value.appliesOn === "string" &&
    appliesOnValues.includes(value.appliesOn)
      ? value.appliesOn as SpellDamageComponent["appliesOn"]
      : fallbackAppliesOn

  return {
    id: optionalString(value.id) || `damage-${index + 1}`,
    label: optionalString(value.label),
    damageType: optionalString(value.damageType),
    dice:
      quantity > 0 && sides
        ? { quantity, sides }
        : undefined,
    flat: value.flat === undefined ? undefined : finiteNumber(value.flat, 0),
    addCastingModifier: Boolean(value.addCastingModifier),
    appliesOn,
    critical:
      value.critical === undefined
        ? rollType === "attack"
        : Boolean(value.critical),
    diceScaling: parseScaling(value.diceScaling),
  }
}

function parseScaling(value: unknown): SpellNumericScaling | undefined {
  if (!isRecord(value)) return undefined
  const source =
    value.source === "character-level" ? "character-level" : "slot-level"

  if (value.type === "step") {
    return {
      type: "step",
      source,
      startLevel: Math.max(0, Math.trunc(finiteNumber(value.startLevel, 0))),
      interval: Math.max(1, Math.trunc(finiteNumber(value.interval, 1))),
      amountPerStep: Math.trunc(finiteNumber(value.amountPerStep, 1)),
      maxSteps:
        value.maxSteps === undefined
          ? undefined
          : Math.max(0, Math.trunc(finiteNumber(value.maxSteps, 0))),
    }
  }

  if (value.type === "thresholds") {
    const thresholds = Array.isArray(value.thresholds)
      ? value.thresholds.flatMap((entry) => {
          if (!isRecord(entry)) return []
          const level = Math.max(0, Math.trunc(finiteNumber(entry.level, -1)))
          const amount = Math.trunc(finiteNumber(entry.amount, 0))
          return level >= 0 ? [{ level, amount }] : []
        })
      : []
    return {
      type: "thresholds",
      source,
      thresholds,
    }
  }

  return undefined
}

function buildTargetingFromJson(
  value: unknown,
  resolution: SpellResolution,
  range: Spell["range"],
): Spell["targeting"] {
  const record = isRecord(value) ? value : {}
  const kinds = [
    "self",
    "single-creature",
    "multiple-creatures",
    "area",
    "object",
    "special",
  ]
  const kind =
    typeof record.kind === "string" && kinds.includes(record.kind)
      ? record.kind as Spell["targeting"]["kind"]
      : range.area
        ? "area"
        : "special"
  return {
    kind,
    targetsSelf:
      record.targetsSelf === undefined
        ? range.origin === "self"
        : Boolean(record.targetsSelf),
    targetCount:
      record.targetCount === undefined
        ? undefined
        : Math.max(1, Math.trunc(finiteNumber(record.targetCount, 1))),
    canTargetMoreAtHigherLevels: Boolean(record.canTargetMoreAtHigherLevels),
    hasAttackRoll: resolution.roll.type === "attack",
    hasSavingThrow: resolution.roll.type === "save",
    savingThrowAttribute:
      resolution.roll.type === "save"
        ? resolution.roll.attribute
        : undefined,
    affectsArea:
      record.affectsArea === undefined
        ? Boolean(range.area)
        : Boolean(record.affectsArea),
    areaShape: range.area?.shape,
    areaSize: range.area?.size,
  }
}

function parseResourceCost(value: unknown): Spell["resourceCost"] {
  if (!isRecord(value)) return undefined
  const resource =
    value.resource === "ki" ||
    value.resource === "sorceryPoints" ||
    value.resource === "channelDivinity"
      ? value.resource
      : undefined
  if (!resource) return undefined
  return {
    resource,
    amount: Math.max(1, Math.trunc(finiteNumber(value.amount, 1))),
  }
}

function parseAreaShape(value: unknown): NonNullable<Spell["range"]["area"]>["shape"] {
  return value === "square" || value === "cone" || value === "line"
    ? value
    : "circle"
}

function parseAttribute(value: unknown): Attribute {
  return value === "str" ||
    value === "con" ||
    value === "int" ||
    value === "wis" ||
    value === "cha"
    ? value
    : "dex"
}

function parseDieSides(value: unknown): DieSides | undefined {
  return value === "d2" ||
    value === "d3" ||
    value === "d4" ||
    value === "d6" ||
    value === "d8" ||
    value === "d10" ||
    value === "d12" ||
    value === "d20" ||
    value === "d100"
    ? value
    : undefined
}

function stringField(
  value: unknown,
  name: string,
  required: boolean,
): string {
  if (typeof value === "string" && (!required || value.trim())) {
    return value.trim()
  }
  if (required) throw new Error(`O campo "${name}" é obrigatório.`)
  return ""
}

function stringArray(value: unknown, name: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`O campo "${name}" precisa ser um array de textos.`)
  }
  return value
}

function integerInRange(
  value: unknown,
  name: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`O campo "${name}" precisa ser um inteiro entre ${min} e ${max}.`)
  }
  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("Clipboard unavailable")
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
