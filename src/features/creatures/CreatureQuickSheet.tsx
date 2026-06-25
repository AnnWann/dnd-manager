import { FileImage, Shield, Swords } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/Button"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"
import type {
  InitiativeEntry,
  InitiativeSide,
} from "../../models/initiative/Initiative"

export type QuickSheetSection = {
  title: string
  content: string
}

export type CombatQuickSheetData = {
  id: string
  name: string
  subtitle?: string
  side?: InitiativeSide
  sheetImageUrl?: string
  initiativeBonus?: number
  armorClass?: number
  currentHp?: number
  maxHp?: number
  temporaryHp?: number
  speed?: string
  passivePerception?: number
  challengeRating?: string
  abilityScores?: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>
  savingThrows?: string
  skills?: string
  vulnerabilities?: string
  resistances?: string
  immunities?: string
  conditionImmunities?: string
  senses?: string
  languages?: string
  conditions?: string[]
  sections: QuickSheetSection[]
}

type CreatureQuickSheetProps = {
  data: CombatQuickSheetData
  preferImage?: boolean
}

export function CreatureQuickSheet({
  data,
  preferImage = false,
}: CreatureQuickSheetProps) {
  const [mode, setMode] = useState<"summary" | "image">(
    preferImage && data.sheetImageUrl ? "image" : "summary",
  )

  useEffect(() => {
    setMode(preferImage && data.sheetImageUrl ? "image" : "summary")
  }, [data.id, data.sheetImageUrl, preferImage])

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-2xl font-semibold text-textH">
              {data.name}
            </h3>
            {data.side ? (
              <span
                className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${sideClassName(data.side)}`}
              >
                {sideLabel(data.side)}
              </span>
            ) : null}
          </div>
          {data.subtitle ? (
            <p className="mt-1 text-sm text-textMuted">{data.subtitle}</p>
          ) : null}
        </div>

        {data.sheetImageUrl ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "summary" ? "primary" : "secondary"}
              onClick={() => setMode("summary")}
            >
              <Swords className="h-4 w-4" />
              Resumo
            </Button>
            <Button
              size="sm"
              variant={mode === "image" ? "primary" : "secondary"}
              onClick={() => setMode("image")}
            >
              <FileImage className="h-4 w-4" />
              Imagem da ficha
            </Button>
          </div>
        ) : null}
      </div>

      {mode === "image" && data.sheetImageUrl ? (
        <div className="overflow-auto rounded-xl border border-border bg-black/15 p-2">
          <img
            src={data.sheetImageUrl}
            alt={`Ficha de ${data.name}`}
            className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain"
          />
        </div>
      ) : (
        <QuickSheetSummary data={data} />
      )}
    </div>
  )
}

function QuickSheetSummary({ data }: { data: CombatQuickSheetData }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Iniciativa" value={signed(data.initiativeBonus)} />
        <StatCard label="CA" value={displayNumber(data.armorClass)} />
        <StatCard
          label="PV"
          value={
            data.currentHp === undefined && data.maxHp === undefined
              ? "—"
              : `${data.currentHp ?? "—"}/${data.maxHp ?? "—"}`
          }
          detail={
            data.temporaryHp ? `+${data.temporaryHp} temporários` : undefined
          }
        />
        <StatCard label="Deslocamento" value={data.speed || "—"} />
        <StatCard
          label="Percepção passiva"
          value={displayNumber(data.passivePerception)}
        />
        <StatCard label="ND" value={data.challengeRating || "—"} />
      </div>

      {data.abilityScores ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(data.abilityScores).map(([attribute, score]) => (
            <div
              key={attribute}
              className="rounded-lg border border-border bg-bg-subtle p-3 text-center"
            >
              <div className="text-[10px] font-bold uppercase text-textMuted">
                {attribute}
              </div>
              <div className="mt-1 text-lg font-semibold text-textH">
                {score}
              </div>
              <div className="text-xs text-textMuted">
                {signed(Math.floor((score - 10) / 2))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {data.conditions && data.conditions.length > 0 ? (
        <InfoBlock
          title="Condições atuais"
          content={data.conditions.join(", ")}
          emphasized
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <OptionalInfo title="Testes de resistência" content={data.savingThrows} />
        <OptionalInfo title="Perícias" content={data.skills} />
        <OptionalInfo title="Vulnerabilidades" content={data.vulnerabilities} />
        <OptionalInfo title="Resistências" content={data.resistances} />
        <OptionalInfo title="Imunidades" content={data.immunities} />
        <OptionalInfo
          title="Imunidades a condições"
          content={data.conditionImmunities}
        />
        <OptionalInfo title="Sentidos" content={data.senses} />
        <OptionalInfo title="Idiomas" content={data.languages} />
      </div>

      {data.sections
        .filter((section) => section.content.trim())
        .map((section) => (
          <InfoBlock
            key={section.title}
            title={section.title}
            content={section.content}
          />
        ))}
    </div>
  )
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-textH">{value}</div>
      {detail ? <div className="text-xs text-accent">{detail}</div> : null}
    </div>
  )
}

function OptionalInfo({ title, content }: { title: string; content?: string }) {
  if (!content?.trim()) return null
  return <InfoBlock title={title} content={content} />
}

function InfoBlock({
  title,
  content,
  emphasized = false,
}: {
  title: string
  content: string
  emphasized?: boolean
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${
        emphasized
          ? "border-accentBorder bg-accentBg"
          : "border-border bg-bg-subtle"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-textH">
        {emphasized ? <Shield className="h-4 w-4 text-accent" /> : null}
        {title}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-text">
        {content}
      </div>
    </section>
  )
}

export function quickSheetFromCompendiumCreature(
  creature: CompendiumCreature,
  entry?: InitiativeEntry,
): CombatQuickSheetData {
  return {
    id: creature.id,
    name: creature.name,
    subtitle: [creature.size, creature.category]
      .filter(Boolean)
      .join(" • "),
    side: entry?.side ?? creature.defaultSide,
    sheetImageUrl: creature.sheetImageUrl,
    initiativeBonus: creature.initiativeBonus,
    armorClass: entry?.armorClass ?? creature.armorClass,
    currentHp: entry?.currentHp ?? creature.maxHp,
    maxHp: entry?.maxHp ?? creature.maxHp,
    temporaryHp: entry?.temporaryHp,
    speed: creature.speed,
    passivePerception: creature.passivePerception,
    challengeRating: creature.challengeRating,
    abilityScores: creature.abilityScores,
    savingThrows: creature.savingThrows,
    skills: creature.skills,
    vulnerabilities: creature.vulnerabilities,
    resistances: creature.resistances,
    immunities: creature.immunities,
    conditionImmunities: creature.conditionImmunities,
    senses: creature.senses,
    languages: creature.languages,
    conditions: entry?.conditions.map((condition) => condition.name),
    sections: [
      { title: "Traços", content: creature.traits },
      { title: "Ações", content: creature.actions },
      { title: "Ações bônus", content: creature.bonusActions },
      { title: "Reações", content: creature.reactions },
      { title: "Ações lendárias", content: creature.legendaryActions },
      { title: "Notas de combate", content: creature.combatNotes },
    ],
  }
}

export function quickSheetFromCharacter(
  character: CharacterTemplate,
  entry?: InitiativeEntry,
): CombatQuickSheetData {
  const sheet = character.get("sheet")
  const attributes = {
    str: character.getEffectiveAttribute("str"),
    dex: character.getEffectiveAttribute("dex"),
    con: character.getEffectiveAttribute("con"),
    int: character.getEffectiveAttribute("int"),
    wis: character.getEffectiveAttribute("wis"),
    cha: character.getEffectiveAttribute("cha"),
  }
  const savingThrows = (
    Object.keys(attributes) as Array<keyof typeof attributes>
  )
    .filter((attribute) => character.isSavingThrowProficient(attribute))
    .map(
      (attribute) =>
        `${attribute.toUpperCase()} ${signed(character.getSavingThrowBonus(attribute))}`,
    )
    .join(", ")
  const abilities = character.getCharacterAbilities()
  const passiveAbilities = abilities.filter(
    (ability) => ability.kind === "passive",
  )
  const actionAbilities = abilities.filter(
    (ability) =>
      ability.kind !== "passive" &&
      (!ability.actionKind || ability.actionKind === "action"),
  )
  const bonusActions = abilities.filter(
    (ability) => ability.actionKind === "bonusAction",
  )
  const reactions = abilities.filter(
    (ability) => ability.actionKind === "reaction",
  )
  const legendaryActions = abilities.filter((ability) =>
    ability.actionKind?.startsWith("legendary"),
  )

  return {
    id: character.get("id"),
    name: character.get("name"),
    subtitle: sheet.classes
      ?.map((classData) => `${classData.className} ${classData.level}`)
      .join(" • "),
    side: entry?.side ?? "ally",
    initiativeBonus: character.getEffectiveInitiative(),
    armorClass: entry?.armorClass ?? character.getEffectiveArmorClass(),
    currentHp: entry?.currentHp ?? sheet.HP.current,
    maxHp: entry?.maxHp ?? character.getEffectiveMaxHp(),
    temporaryHp:
      entry?.temporaryHp ?? character.getEffectiveTemporaryHp(),
    speed: `${character.getEffectiveMobility()} m`,
    passivePerception: character.getEffectivePassivePerception(),
    abilityScores: attributes,
    savingThrows,
    conditions: entry?.conditions.map((condition) => condition.name),
    sections: [
      { title: "Traços e passivas", content: formatAbilities(passiveAbilities) },
      { title: "Ações", content: formatAbilities(actionAbilities) },
      { title: "Ações bônus", content: formatAbilities(bonusActions) },
      { title: "Reações", content: formatAbilities(reactions) },
      {
        title: "Ações e resistências lendárias",
        content: formatAbilities(legendaryActions),
      },
    ],
  }
}

export function quickSheetFromInitiativeEntry(
  entry: InitiativeEntry,
): CombatQuickSheetData {
  return {
    id: entry.id,
    name: entry.name,
    subtitle: "Entrada rápida de iniciativa",
    side: entry.side,
    initiativeBonus: entry.initiativeBonus,
    armorClass: entry.armorClass,
    currentHp: entry.currentHp,
    maxHp: entry.maxHp,
    temporaryHp: entry.temporaryHp,
    conditions: entry.conditions.map((condition) => condition.name),
    sections: [],
  }
}

function formatAbilities(
  abilities: Array<{ name: string; description?: string }>,
): string {
  return abilities
    .map((ability) =>
      ability.description?.trim()
        ? `${ability.name}. ${ability.description}`
        : ability.name,
    )
    .join("\n\n")
}

function displayNumber(value: number | undefined): string {
  return value === undefined ? "—" : String(value)
}

function signed(value: number | undefined): string {
  if (value === undefined) return "—"
  return value >= 0 ? `+${value}` : String(value)
}

function sideLabel(side: InitiativeSide): string {
  if (side === "ally") return "Aliado"
  if (side === "enemy") return "Inimigo"
  return "Neutro"
}

function sideClassName(side: InitiativeSide): string {
  if (side === "ally") {
    return "border-accentBorder bg-accentBg text-accent"
  }
  if (side === "enemy") {
    return "border-danger bg-transparent text-danger"
  }
  return "border-border bg-bg-subtle text-textMuted"
}
