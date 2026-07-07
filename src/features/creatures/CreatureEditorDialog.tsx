import {
  ClipboardPaste,
  FileImage,
  ImagePlus,
  Trash2,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Textarea } from "../../components/ui/Textarea"
import { uploadImage } from "../../lib/uploadImage"
import {
  normalizeCompendiumCreature,
  type CompendiumCreature,
  type CreatureAbilityScores,
  type CreatureSide,
} from "../../models/creatures/CompendiumCreature"

type CreatureEditorDialogProps = {
  creature: CompendiumCreature
  onClose: () => void
  onSave: (creature: CompendiumCreature) => void
}

const selectClassName =
  "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"

export function CreatureEditorDialog({
  creature,
  onClose,
  onSave,
}: CreatureEditorDialogProps) {
  const [draft, setDraft] = useState(creature)
  const [uploading, setUploading] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState("")
  const [jsonError, setJsonError] = useState<string>()

  useEffect(() => {
    setDraft(creature)
    setJsonOpen(false)
    setJsonText("")
    setJsonError(undefined)
  }, [creature])

  function patch(patchValue: Partial<CompendiumCreature>) {
    setDraft((current) => ({ ...current, ...patchValue }))
  }

  function patchAbility(
    attribute: keyof CreatureAbilityScores,
    value: number,
  ) {
    setDraft((current) => ({
      ...current,
      abilityScores: {
        ...current.abilityScores,
        [attribute]: value,
      },
    }))
  }

  async function handleCreatureImage(file: File | undefined) {
    if (!file) return

    setUploading(true)
    try {
      const url = await uploadImage(file)
      patch({ sheetImageUrl: url })
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Falha ao importar imagem.",
      )
    } finally {
      setUploading(false)
    }
  }

  async function pasteJsonFromClipboard() {
    try {
      const clipboardText = await navigator.clipboard.readText()
      setJsonText(clipboardText)
      setJsonError(undefined)
    } catch {
      setJsonError(
        "O navegador não permitiu ler a área de transferência. Cole o JSON manualmente no campo abaixo.",
      )
    }
  }

  function applyPastedJson() {
    try {
      const payload = parsePastedJson(jsonText)
      const importedCreature = normalizeCompendiumCreature(payload)

      setDraft((current) => ({
        ...importedCreature,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
        sheetImageUrl:
          importedCreature.sheetImageUrl ?? current.sheetImageUrl,
      }))
      setJsonError(undefined)
      setJsonText("")
      setJsonOpen(false)
    } catch (error) {
      setJsonError(
        error instanceof Error
          ? error.message
          : "Não foi possível interpretar o JSON.",
      )
    }
  }

  function save() {
    const name = draft.name.trim()
    if (!name) return
    onSave({ ...draft, name, updatedAt: Date.now() })
  }

  return (
    <Modal
      title={
        creature.name === "Nova criatura"
          ? "Criar criatura"
          : `Editar ${creature.name}`
      }
      onClose={onClose}
      className="max-w-5xl"
    >
      <div className="grid gap-5">
        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-textH">
                Preencher criatura com JSON
              </h3>
              <p className="mt-1 text-xs text-textMuted">
                Cole um objeto criado manualmente ou por uma IA para preencher o
                formulário. O identificador desta criatura será preservado.
              </p>
            </div>

            <Button
              variant={jsonOpen ? "primary" : "secondary"}
              onClick={() => {
                setJsonOpen((current) => !current)
                setJsonError(undefined)
              }}
            >
              <ClipboardPaste className="h-4 w-4" />
              {jsonOpen ? "Fechar JSON" : "Colar JSON"}
            </Button>
          </div>

          {jsonOpen ? (
            <div className="mt-4 grid gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-textMuted">
                  Aceita um objeto único, uma lista com uma criatura ou
                  blocos cercados por <code>```json</code>.
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void pasteJsonFromClipboard()}
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Colar da área de transferência
                </Button>
              </div>

              <Textarea
                className="min-h-64 font-mono text-xs leading-5"
                value={jsonText}
                onChange={(event) => {
                  setJsonText(event.target.value)
                  setJsonError(undefined)
                }}
                placeholder={'{\n  "name": "Goblin",\n  "armorClass": 15,\n  "maxHp": 7,\n  "imageUrl": "https://..."\n}'}
                autoFocus
              />

              {jsonError ? (
                <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {jsonError}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setJsonText("")
                    setJsonError(undefined)
                    setJsonOpen(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={applyPastedJson}
                  disabled={!jsonText.trim()}
                >
                  Aplicar JSON ao formulário
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4 lg:grid-cols-[240px_1fr]">
          <div className="grid content-start gap-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-bg">
              {draft.sheetImageUrl ? (
                <img
                  src={draft.sheetImageUrl}
                  alt={`Imagem de ${draft.name}`}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="grid justify-items-center gap-2 px-4 text-center text-textMuted">
                  <FileImage className="h-12 w-12" />
                  <span className="text-xs">Sem imagem da criatura</span>
                </div>
              )}
            </div>

            <p className="text-xs leading-5 text-textMuted">
              Use uma arte, retrato ou token que represente visualmente o
              monstro. Essa imagem também será usada na iniciativa.
            </p>

            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={(event) =>
                  void handleCreatureImage(event.target.files?.[0])
                }
              />
              <span className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg text-sm font-medium text-textH shadow-theme-sm transition-colors hover:border-borderStrong hover:bg-bg-subtle">
                <ImagePlus className="h-4 w-4" />
                {uploading ? "Enviando…" : "Importar imagem da criatura"}
              </span>
            </label>

            {draft.sheetImageUrl ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => patch({ sheetImageUrl: undefined })}
              >
                <Trash2 className="h-4 w-4" />
                Remover imagem
              </Button>
            ) : null}
          </div>

          <div className="grid content-start gap-4">
            <SectionTitle
              title="Identificação"
              description="Somente os dados que o mestre costuma consultar durante jogo e combate."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" className="sm:col-span-2">
                <Input
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  autoFocus={!jsonOpen}
                />
              </Field>

              <Field label="Categoria">
                <Input
                  value={draft.category}
                  placeholder="Monstro, humanoide, morto-vivo…"
                  onChange={(event) => patch({ category: event.target.value })}
                />
              </Field>

              <Field label="Tamanho">
                <Input
                  value={draft.size}
                  placeholder="Médio"
                  onChange={(event) => patch({ size: event.target.value })}
                />
              </Field>

              <Field label="Nível de desafio">
                <Input
                  value={draft.challengeRating}
                  placeholder="Ex.: 5"
                  onChange={(event) =>
                    patch({ challengeRating: event.target.value })
                  }
                />
              </Field>

              <Field label="Lado padrão">
                <select
                  className={selectClassName}
                  value={draft.defaultSide}
                  onChange={(event) =>
                    patch({ defaultSide: event.target.value as CreatureSide })
                  }
                >
                  <option value="enemy">Inimigo</option>
                  <option value="ally">Aliado</option>
                  <option value="neutral">Neutro</option>
                </select>
              </Field>

              <label className="flex items-center gap-3 rounded-lg border border-border bg-bg p-3 text-sm text-textH sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.unique}
                  onChange={(event) => patch({ unique: event.target.checked })}
                />
                Criatura única — não numerar cópias automaticamente
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <SectionTitle
            title="Combate"
            description="Valores usados ao adicionar a criatura à iniciativa."
          />

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <NumberField
              label="Iniciativa"
              value={draft.initiativeBonus}
              onChange={(value) => patch({ initiativeBonus: value ?? 0 })}
            />
            <NumberField
              label="CA"
              value={draft.armorClass}
              onChange={(value) => patch({ armorClass: value })}
            />
            <NumberField
              label="PV máximos"
              value={draft.maxHp}
              min={0}
              onChange={(value) => patch({ maxHp: value })}
            />
            <Field label="Deslocamento">
              <Input
                value={draft.speed}
                placeholder="9 m"
                onChange={(event) => patch({ speed: event.target.value })}
              />
            </Field>
            <NumberField
              label="Percepção passiva"
              value={draft.passivePerception}
              onChange={(value) => patch({ passivePerception: value })}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(
              Object.keys(draft.abilityScores) as Array<
                keyof CreatureAbilityScores
              >
            ).map((attribute) => (
              <NumberField
                key={attribute}
                label={attribute.toUpperCase()}
                value={draft.abilityScores[attribute]}
                onChange={(value) => patchAbility(attribute, value ?? 10)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <SectionTitle title="Referência rápida" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextField
              label="Testes de resistência"
              value={draft.savingThrows}
              placeholder="DES +5, SAB +3"
              onChange={(savingThrows) => patch({ savingThrows })}
            />
            <TextField
              label="Perícias"
              value={draft.skills}
              placeholder="Percepção +5, Furtividade +7"
              onChange={(skills) => patch({ skills })}
            />
            <TextField
              label="Vulnerabilidades"
              value={draft.vulnerabilities}
              onChange={(vulnerabilities) => patch({ vulnerabilities })}
            />
            <TextField
              label="Resistências"
              value={draft.resistances}
              onChange={(resistances) => patch({ resistances })}
            />
            <TextField
              label="Imunidades"
              value={draft.immunities}
              onChange={(immunities) => patch({ immunities })}
            />
            <TextField
              label="Imunidades a condições"
              value={draft.conditionImmunities}
              onChange={(conditionImmunities) =>
                patch({ conditionImmunities })
              }
            />
            <TextField
              label="Sentidos"
              value={draft.senses}
              onChange={(senses) => patch({ senses })}
            />
            <TextField
              label="Idiomas"
              value={draft.languages}
              onChange={(languages) => patch({ languages })}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <SectionTitle
            title="Ações e notas"
            description="Texto livre para manter o criador rápido e confortável para o mestre."
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <LongText
              label="Traços"
              value={draft.traits}
              onChange={(traits) => patch({ traits })}
            />
            <LongText
              label="Ações"
              value={draft.actions}
              onChange={(actions) => patch({ actions })}
            />
            <LongText
              label="Ações bônus"
              value={draft.bonusActions}
              onChange={(bonusActions) => patch({ bonusActions })}
            />
            <LongText
              label="Reações"
              value={draft.reactions}
              onChange={(reactions) => patch({ reactions })}
            />
            <LongText
              label="Ações lendárias"
              value={draft.legendaryActions}
              onChange={(legendaryActions) => patch({ legendaryActions })}
            />
            <LongText
              label="Notas de combate"
              value={draft.combatNotes}
              onChange={(combatNotes) => patch({ combatNotes })}
            />
          </div>
        </section>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={!draft.name.trim()}>
          Salvar criatura
        </Button>
      </div>
    </Modal>
  )
}

function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-textH">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs text-textMuted">{description}</p>
      ) : null}
    </div>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={`grid gap-1.5 text-xs font-medium text-textH ${className ?? ""}`}
    >
      {label}
      {children}
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: number | undefined
  min?: number
  onChange: (value: number | undefined) => void
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(event) => onChange(optionalNumber(event.target.value))}
      />
    </Field>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function LongText({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <Textarea
        className="min-h-32"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function parsePastedJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("Cole um JSON antes de aplicar.")

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")

  let payload: unknown
  try {
    payload = JSON.parse(withoutFence)
  } catch (error) {
    throw new Error(
      error instanceof Error ? `JSON inválido: ${error.message}` : "JSON inválido.",
    )
  }

  if (Array.isArray(payload)) {
    if (payload.length !== 1) {
      throw new Error(
        "O criador aceita uma criatura por vez. Cole uma lista contendo exatamente uma criatura.",
      )
    }
    return payload[0]
  }

  const record = asRecord(payload)
  if (!record) throw new Error("O JSON precisa representar uma criatura.")

  if (record.creature !== undefined) return record.creature

  if (Array.isArray(record.creatures)) {
    if (record.creatures.length !== 1) {
      throw new Error(
        "O criador aceita uma criatura por vez. O campo creatures precisa conter exatamente uma criatura.",
      )
    }
    return record.creatures[0]
  }

  return record
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
