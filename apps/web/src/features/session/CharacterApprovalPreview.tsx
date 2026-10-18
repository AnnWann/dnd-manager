import { useEffect, useMemo } from "react"

import { CLASS_NAMES } from "../../contexts/consts"
import { useMagicContext } from "../../contexts/magicContext"
import { applyCharacterDomains } from "../../lib/characterDomains"
import { formatRaceName } from "../../lib/raceNames"
import { CharacterTemplate, type CharacterTemplateProps } from "../../models/characters/CharacterTemplate"
import type { SessionCharacterPreview } from "../../api/session-requests"

const ATTRIBUTE_LABELS = {
  str: "FOR",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
} as const

export function CharacterApprovalPreview({ preview }: { preview: SessionCharacterPreview }) {
  const { ensureOfficialSpells, getSpellByIndex } = useMagicContext()
  const character = useMemo(() => materializeCharacter(preview), [preview])
  const sheet = character.get("sheet")
  const profile = character.get("profile")
  const magic = character.get("magic")
  const abilities = character.get("abilities") ?? []
  const inventory = character.get("inventory") ?? []
  const equipment = character.get("equipment")
  const knownSpells = magic?.spells?.knownSpells ?? []
  const spellIndexes = useMemo(
    () => Array.from(new Set(knownSpells.map((entry) => entry.spells.id).filter(Boolean))),
    [knownSpells],
  )

  useEffect(() => {
    if (spellIndexes.length) void ensureOfficialSpells(spellIndexes)
  }, [ensureOfficialSpells, spellIndexes])

  const classSummary = (sheet.classes ?? [])
    .map((entry) => {
      const className = CLASS_NAMES[entry.className] ?? entry.className
      const subclass = entry.subclass?.name ? ` (${entry.subclass.name})` : ""
      return `${className}${subclass} ${entry.level}`
    })
    .join(" / ") || "Sem classe"
  const totalLevel = (sheet.classes ?? []).reduce((sum, entry) => sum + Number(entry.level || 0), 0)
  const raceName = sheet.race.race === "custom"
    ? sheet.race.customName?.trim() || "Raça personalizada"
    : formatRaceName(sheet.race.race)
  const hp = sheet.HP

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-xl border border-border bg-bg-subtle">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          {profile.imageUrl ? (
            <img
              src={profile.imageUrl}
              alt=""
              className="h-24 w-24 shrink-0 rounded-xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-border bg-bg text-3xl font-semibold text-textMuted">
              {preview.name.trim().slice(0, 1).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xl font-semibold text-textH">{preview.name}</div>
            <div className="mt-1 text-sm text-text">{raceName} · {classSummary}</div>
            <div className="mt-1 text-xs text-textMuted">
              Nível total {totalLevel} · Jogador: {preview.owner.name}
            </div>
            {profile.background ? (
              <div className="mt-2 text-xs text-textMuted">Antecedente: {String(profile.background)}</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="PV" value={`${hp.current}/${hp.max}`} detail={hp.temporary ? `+${hp.temporary} temp.` : undefined} />
        <Metric label="CA" value={String(sheet.stats.armorClass)} />
        <Metric label="Iniciativa" value={signed(sheet.stats.initiative)} />
        <Metric label="Deslocamento" value={String(sheet.stats.mobility)} />
        <Metric label="Percepção passiva" value={String(sheet.stats.passive_perception)} />
        <Metric label="Inspiração" value={sheet.stats.inspiration ? "Sim" : "Não"} />
      </section>

      <section>
        <SectionTitle>Atributos</SectionTitle>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(Object.keys(ATTRIBUTE_LABELS) as Array<keyof typeof ATTRIBUTE_LABELS>).map((attribute) => {
            const value = Number(sheet.attributes[attribute] ?? 10)
            return (
              <div key={attribute} className="rounded-xl border border-border bg-bg-subtle p-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">{ATTRIBUTE_LABELS[attribute]}</div>
                <div className="mt-1 text-xl font-bold text-textH">{value}</div>
                <div className="text-xs text-textMuted">{signed(Math.floor((value - 10) / 2))}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>Testes de resistência</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(ATTRIBUTE_LABELS) as Array<keyof typeof ATTRIBUTE_LABELS>).map((attribute) => (
              <Pill key={attribute} active={Boolean(sheet.savingThrowProficiencies?.[attribute])}>
                {ATTRIBUTE_LABELS[attribute]}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>Proficiências</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {sheet.proficiencies?.length ? sheet.proficiencies.map((entry, index) => (
              <Pill key={`${readLabel(entry)}:${index}`} active>{readLabel(entry)}</Pill>
            )) : <Empty>Nenhuma proficiência registrada.</Empty>}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Perícias</SectionTitle>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(sheet.skills ?? {}).length ? Object.entries(sheet.skills ?? {}).map(([key, value]) => (
            <InfoRow key={key} label={humanize(key)} value={formatSkillValue(value)} />
          )) : <Empty>Nenhuma perícia configurada.</Empty>}
        </div>
      </section>

      <section>
        <SectionTitle>Habilidades</SectionTitle>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {abilities.length ? abilities.map((ability, index) => (
            <div key={`${ability.name}:${index}`} className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="font-medium text-textH">{ability.name || "Habilidade sem nome"}</div>
              {ability.description ? (
                <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-textMuted">{ability.description}</div>
              ) : null}
            </div>
          )) : <Empty>Nenhuma habilidade registrada.</Empty>}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Magias</SectionTitle>
          <span className="text-xs text-textMuted">
            {knownSpells.filter((entry) => entry.spells.prepared).length} preparada(s) · {knownSpells.length} disponível(is)
          </span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {knownSpells.length ? knownSpells.map((entry, index) => {
            const spell = getSpellByIndex(entry.spells.id)
            return (
              <div key={`${entry.spells.id}:${index}`} className="rounded-xl border border-border bg-bg-subtle p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-textH">{spell?.name ?? entry.spells.id}</div>
                  {entry.spells.prepared ? (
                    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">Preparada</span>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-textMuted">
                  {spell ? `${spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`} · ${spell.school}` : readSpellSource(entry.source)}
                </div>
              </div>
            )
          }) : <Empty>Nenhuma magia registrada.</Empty>}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>Inventário</SectionTitle>
          <div className="mt-2 grid gap-2">
            {inventory.length ? inventory.map((item, index) => (
              <InfoRow key={`${readLabel(item)}:${index}`} label={readLabel(item)} value={readQuantity(item)} />
            )) : <Empty>Inventário vazio.</Empty>}
          </div>
        </div>
        <div>
          <SectionTitle>Equipamento</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {extractEquipmentNames(equipment).length ? extractEquipmentNames(equipment).map((name, index) => (
              <Pill key={`${name}:${index}`} active>{name}</Pill>
            )) : <Empty>Nenhum equipamento identificado.</Empty>}
          </div>
        </div>
      </section>

      {(profile.traits || profile.physicalAppearance || profile.history || profile.relationships?.length) ? (
        <section>
          <SectionTitle>Perfil</SectionTitle>
          <div className="mt-2 grid gap-3">
            {profile.traits ? <TextBlock label="Traços" text={profile.traits} /> : null}
            {profile.physicalAppearance ? <TextBlock label="Aparência" text={profile.physicalAppearance} /> : null}
            {profile.history ? <TextBlock label="História" text={profile.history} /> : null}
            {profile.relationships?.length ? (
              <TextBlock label="Relações" text={profile.relationships.map((entry) => typeof entry === "string" ? entry : readLabel(entry)).join("\n")} />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function materializeCharacter(preview: SessionCharacterPreview): CharacterTemplate {
  const base = {
    ...(preview.data as Partial<CharacterTemplateProps>),
    id: preview.id,
    name: preview.name,
    owner: {
      id: preview.owner.id,
      name: preview.owner.name,
      role: "player" as const,
    },
  }
  const merged = applyCharacterDomains(
    CharacterTemplate.fromJSON(base).toJSON(),
    preview.domains as never,
  )
  return CharacterTemplate.fromJSON(merged)
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">{label}</div>
      <div className="mt-1 text-lg font-bold text-textH">{value}</div>
      {detail ? <div className="text-[10px] text-textMuted">{detail}</div> : null}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-textH">{children}</h3>
}

function Pill({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={active
      ? "rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-xs text-textH"
      : "rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-xs text-textMuted opacity-60"}
    >
      {children}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-xs">
      <span className="min-w-0 truncate text-textH">{label}</span>
      <span className="shrink-0 text-textMuted">{value}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-textMuted">{children}</div>
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-xs font-semibold text-textH">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-xs leading-5 text-text">{text}</div>
    </div>
  )
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatSkillValue(value: unknown): string {
  if (typeof value === "number") return signed(value)
  if (typeof value === "boolean") return value ? "Proficiente" : "—"
  if (typeof value === "string") return value
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.bonus === "number") return signed(record.bonus)
    if (record.expertise) return "Especialista"
    if (record.proficient) return "Proficiente"
  }
  return "Configurada"
}

function readLabel(value: unknown): string {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return "Item"
  const record = value as Record<string, unknown>
  for (const key of ["name", "label", "title", "type", "id"]) {
    if (typeof record[key] === "string" && String(record[key]).trim()) return String(record[key])
  }
  return "Item"
}

function readQuantity(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  const quantity = record.quantity ?? record.amount ?? record.count
  return typeof quantity === "number" && quantity !== 1 ? `×${quantity}` : ""
}

function readSpellSource(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  const className = typeof record.className === "string" ? record.className : ""
  return className ? CLASS_NAMES[className] ?? className : ""
}

function extractEquipmentNames(value: unknown): string[] {
  const result: string[] = []
  const seen = new Set<unknown>()

  function visit(current: unknown, depth: number) {
    if (depth > 4 || current == null || seen.has(current)) return
    if (typeof current !== "object") return
    seen.add(current)
    if (Array.isArray(current)) {
      current.forEach((entry) => visit(entry, depth + 1))
      return
    }
    const record = current as Record<string, unknown>
    if (typeof record.name === "string" && record.name.trim()) result.push(record.name.trim())
    for (const [key, entry] of Object.entries(record)) {
      if (["acquisition", "bonuses", "description", "notes"].includes(key)) continue
      visit(entry, depth + 1)
    }
  }

  visit(value, 0)
  return Array.from(new Set(result))
}
