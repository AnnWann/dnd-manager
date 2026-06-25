import { FileImage, ImagePlus, Trash2 } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Textarea } from "../../components/ui/Textarea"
import { uploadImage } from "../../lib/uploadImage"
import type {
  CompendiumCreature,
  CreatureAbilityScores,
  CreatureSide,
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

  useEffect(() => setDraft(creature), [creature])

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

  async function handleSheetImage(file: File | undefined) {
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

  function save() {
    const name = draft.name.trim()
    if (!name) return
    onSave({ ...draft, name, updatedAt: Date.now() })
  }

  return (
    <Modal
      title={creature.name === "Nova criatura" ? "Criar criatura" : `Editar ${creature.name}`}
      onClose={onClose}
      className="max-w-5xl"
    >
      <div className="grid gap-5">
        <section className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4 lg:grid-cols-[240px_1fr]">
          <div className="grid content-start gap-3">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-border bg-bg">
              {draft.sheetImageUrl ? (
                <img
                  src={draft.sheetImageUrl}
                  alt={`Ficha de ${draft.name}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="grid justify-items-center gap-2 text-textMuted">
                  <FileImage className="h-12 w-12" />
                  <span className="text-xs">Sem imagem da ficha</span>
                </div>
              )}
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={(event) =>
                  void handleSheetImage(event.target.files?.[0])
                }
              />
              <span className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg text-sm font-medium text-textH shadow-theme-sm transition-colors hover:border-borderStrong hover:bg-bg-subtle">
                <ImagePlus className="h-4 w-4" />
                {uploading ? "Enviando…" : "Importar imagem da ficha"}
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
                  autoFocus
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
            {(Object.keys(draft.abilityScores) as Array<keyof CreatureAbilityScores>).map(
              (attribute) => (
                <NumberField
                  key={attribute}
                  label={attribute.toUpperCase()}
                  value={draft.abilityScores[attribute]}
                  onChange={(value) => patchAbility(attribute, value ?? 10)}
                />
              ),
            )}
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
    <label className={`grid gap-1.5 text-xs font-medium text-textH ${className ?? ""}`}>
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

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
