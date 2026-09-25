import { readFile, writeFile } from "node:fs/promises"

const LOCAL_PATH = new URL("../src/data/spells.v1.json", import.meta.url)
const UPSTREAM_REVISION = "bce51b3958573819e3b842fbc0cd9524fe4bc2e1"
const UPSTREAM_URL =
  `https://raw.githubusercontent.com/5e-bits/5e-database/${UPSTREAM_REVISION}/src/2014/en/5e-SRD-Spells.json`

const ATTRIBUTES = new Set(["str", "dex", "con", "int", "wis", "cha"])
const SKIP_NO_ROLL_DAMAGE = new Set([
  "branding-smite",
  "call-lightning",
  "dimension-door",
  "divine-favor",
  "fire-shield",
  "flame-blade",
  "flaming-sphere",
])

const local = JSON.parse(await readFile(LOCAL_PATH, "utf8"))
const response = await fetch(UPSTREAM_URL)
if (!response.ok) {
  throw new Error(`Failed to load upstream spell data: ${response.status}`)
}
const upstream = await response.json()
const upstreamByIndex = new Map(upstream.map((spell) => [spell.index, spell]))

let enriched = 0
for (const spell of local.spells ?? []) {
  const resolution = makeResolution(spell, upstreamByIndex.get(spell.index))
  if (resolution) {
    spell.resolution = resolution
    spell.targeting ??= {}
    spell.targeting.hasAttackRoll = resolution.roll.type === "attack"
    spell.targeting.hasSavingThrow = resolution.roll.type === "save"
    if (resolution.roll.type === "save") {
      spell.targeting.savingThrowAttribute = resolution.roll.attribute
    } else {
      delete spell.targeting.savingThrowAttribute
    }
    enriched += 1
  } else {
    delete spell.resolution
  }
}

const oldNote =
  "damageDice is omitted because the local Die type shape was not provided."
local.notes = (local.notes ?? []).map((note) =>
  note === oldNote
    ? "Legacy damageDice remains omitted for official spells; authoritative mechanics use structured resolution data."
    : note,
)
const resolutionNote =
  "Structured spell resolution is derived from the upstream SRD mechanical fields; translated descriptions are preserved."
if (!local.notes.includes(resolutionNote)) local.notes.push(resolutionNote)

await writeFile(LOCAL_PATH, JSON.stringify(local, null, 2) + "\n", "utf8")
console.log(`Enriched ${enriched} official spells with structured resolution.`)

function makeResolution(spell, sourceSpell) {
  const attack =
    Boolean(sourceSpell?.attack_type) ||
    Boolean(spell.targeting?.hasAttackRoll)
  const saveAttribute =
    sourceSpell?.dc?.dc_type?.index ??
    spell.targeting?.savingThrowAttribute
  const save =
    Boolean(sourceSpell?.dc) ||
    Boolean(spell.targeting?.hasSavingThrow)

  let roll = attack
    ? { type: "attack" }
    : save && ATTRIBUTES.has(saveAttribute)
      ? {
          type: "save",
          attribute: saveAttribute,
          onSuccess: mapSaveSuccess(sourceSpell?.dc?.dc_success),
        }
      : { type: "none" }

  const sourceDamage = Array.isArray(sourceSpell?.damage)
    ? sourceSpell.damage
    : sourceSpell?.damage
      ? [sourceSpell.damage]
      : []

  let damage = sourceDamage
    .map((entry, index) => baseDamage(entry, spell, roll.type, index))
    .filter(Boolean)
  let instances

  if (spell.index === "scorching-ray") {
    roll = { type: "attack" }
    instances = {
      base: 3,
      scaling: stepScaling("slot-level", 2, 1, 1),
    }
    damage = [
      damageComponent("fire", "Dano por raio", 2, "d6", "hit", true),
    ]
  } else if (spell.index === "eldritch-blast") {
    roll = { type: "attack" }
    instances = {
      base: 1,
      scaling: {
        type: "thresholds",
        source: "character-level",
        thresholds: [
          { level: 5, amount: 1 },
          { level: 11, amount: 1 },
          { level: 17, amount: 1 },
        ],
      },
    }
    damage = [
      damageComponent("force", "Dano por feixe", 1, "d10", "hit", true),
    ]
  } else if (spell.index === "magic-missile") {
    roll = { type: "none" }
    instances = {
      base: 3,
      scaling: stepScaling("slot-level", 1, 1, 1),
    }
    damage = [
      {
        ...damageComponent(
          "force",
          "Dano por dardo",
          1,
          "d4",
          "always",
          false,
        ),
        flat: 1,
      },
    ]
  } else if (spell.index === "spiritual-weapon") {
    roll = { type: "attack" }
    damage = [
      {
        ...damageComponent("force", "Dano", 1, "d8", "hit", true),
        addCastingModifier: true,
        diceScaling: stepScaling("slot-level", 2, 2, 1),
      },
    ]
  } else if (spell.index === "acid-arrow") {
    roll = { type: "attack" }
    const scaling = stepScaling("slot-level", 2, 1, 1)
    damage = [
      {
        ...damageComponent(
          "acid",
          "Dano inicial",
          4,
          "d4",
          "hit",
          true,
        ),
        id: "damage-acid-initial",
        diceScaling: scaling,
      },
      {
        ...damageComponent(
          "acid",
          "Dano no fim do próximo turno",
          2,
          "d4",
          "hit",
          false,
        ),
        id: "damage-acid-later",
        diceScaling: scaling,
      },
    ]
  } else if (spell.index === "flame-strike") {
    // Its upcast increases either fire OR radiant damage at the caster's
    // choice, so only the unambiguous base damage is automated.
    roll = { type: "save", attribute: "dex", onSuccess: "half" }
    damage = [
      damageComponent(
        "fire",
        "Dano de fogo",
        4,
        "d6",
        "failed-save",
        false,
      ),
      damageComponent(
        "radiant",
        "Dano radiante",
        4,
        "d6",
        "failed-save",
        false,
      ),
    ]
  }

  if (
    roll.type === "none" &&
    damage.length > 0 &&
    spell.index !== "magic-missile" &&
    SKIP_NO_ROLL_DAMAGE.has(spell.index)
  ) {
    damage = []
  }

  if (roll.type === "none" && damage.length === 0 && !instances) {
    return undefined
  }

  return {
    roll,
    ...(instances ? { instances } : {}),
    ...(damage.length ? { damage } : {}),
  }
}

function baseDamage(entry, spell, rollType, index) {
  const table =
    entry.damage_at_slot_level ??
    entry.damage_at_character_level
  const source = entry.damage_at_slot_level
    ? "slot-level"
    : entry.damage_at_character_level
      ? "character-level"
      : undefined
  const damageType = entry.damage_type?.index
  if (!table || !source || !damageType) return undefined

  const rows = Object.entries(table)
    .map(([level, expression]) => ({
      level: Number(level),
      parsed: parseDiceExpression(expression),
    }))
    .sort((left, right) => left.level - right.level)

  const base = source === "slot-level"
    ? rows.find(
        (row) => row.level === spell.slotLevel && row.parsed,
      ) ?? rows.find((row) => row.parsed)
    : rows.find((row) => row.parsed)

  if (!base?.parsed) return undefined

  const scaling = scalingFromTable(
    table,
    source,
    base.level,
    base.parsed,
  )

  return {
    id: `damage-${damageType}-${index + 1}`,
    label: "Dano",
    damageType,
    dice: {
      quantity: base.parsed.quantity,
      sides: base.parsed.sides,
    },
    ...(base.parsed.flat ? { flat: base.parsed.flat } : {}),
    appliesOn:
      rollType === "attack"
        ? "hit"
        : rollType === "save"
          ? "failed-save"
          : "always",
    critical: rollType === "attack",
    ...(scaling ? { diceScaling: scaling } : {}),
  }
}

function scalingFromTable(table, source, baseLevel, baseDice) {
  const rows = Object.entries(table)
    .map(([level, expression]) => ({
      level: Number(level),
      parsed: parseDiceExpression(expression),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.level) &&
        row.parsed &&
        row.parsed.sides === baseDice.sides,
    )
    .sort((left, right) => left.level - right.level)

  let previousQuantity = baseDice.quantity
  const thresholds = []

  for (const row of rows) {
    if (row.level <= baseLevel) {
      previousQuantity = row.parsed.quantity
      continue
    }

    const amount = row.parsed.quantity - previousQuantity
    if (amount !== 0) thresholds.push({ level: row.level, amount })
    previousQuantity = row.parsed.quantity
  }

  return thresholds.length
    ? { type: "thresholds", source, thresholds }
    : undefined
}

function parseDiceExpression(expression) {
  if (typeof expression !== "string") return undefined
  const compact = expression.replace(/\s+/g, "").toUpperCase()

  if (/^\d+$/.test(compact)) {
    return {
      quantity: 0,
      sides: "d2",
      flat: Number(compact),
    }
  }

  const match = compact.match(
    /^(\d+)D(2|3|4|6|8|10|12|20|100)(?:([+-])(\d+))?$/,
  )
  if (!match) return undefined

  return {
    quantity: Number(match[1]),
    sides: `d${match[2]}`,
    flat: match[3]
      ? (match[3] === "-" ? -1 : 1) * Number(match[4])
      : 0,
  }
}

function damageComponent(
  damageType,
  label,
  quantity,
  sides,
  appliesOn,
  critical,
) {
  return {
    id: `damage-${damageType}-1`,
    label,
    damageType,
    dice: { quantity, sides },
    appliesOn,
    critical,
  }
}

function stepScaling(
  source,
  startLevel,
  interval,
  amountPerStep,
) {
  return {
    type: "step",
    source,
    startLevel,
    interval,
    amountPerStep,
  }
}

function mapSaveSuccess(value) {
  if (value === "half") return "half"
  if (value === "none") return "none"
  return "none"
}
