import { Plus, Trash2 } from "lucide-react"

import { Button } from "../../components/ui/Button"
import {
  DAMAGE_TYPE_OPTIONS,
  damageAffinityLabel,
  type DamageAffinity,
  type DamageAffinityKind,
  type DamageAffinityQualifier,
  type DamageType,
} from "../../models/combat/Damage"

const selectClassName =
  "h-9 min-w-0 rounded-lg border border-border bg-bg px-2 text-xs text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"

export function DamageAffinityEditor({
  value,
  onChange,
  title = "Defesas de dano",
  description = "As mesmas regras são usadas pela ficha, compêndio e iniciativa para calcular dano automaticamente.",
}: {
  value: DamageAffinity[]
  onChange: (value: DamageAffinity[]) => void
  title?: string
  description?: string
}) {
  function patch(index: number, next: Partial<DamageAffinity>) {
    onChange(value.map((entry, current) => current === index ? { ...entry, ...next } : entry))
  }

  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-textH">{title}</div>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-textMuted">{description}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange([
            ...value,
            { damageType: "fire", kind: "resistance", qualifier: "any" },
          ])}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {value.length ? (
        <div className="mt-3 grid gap-2">
          {value.map((entry, index) => (
            <div
              key={`${entry.damageType}:${entry.kind}:${index}`}
              className="grid gap-2 rounded-lg border border-border bg-bg-subtle p-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <select
                className={selectClassName}
                value={entry.kind}
                aria-label="Reação ao dano"
                onChange={(event) => patch(index, { kind: event.target.value as DamageAffinityKind })}
              >
                <option value="resistance">{damageAffinityLabel("resistance")}</option>
                <option value="immunity">{damageAffinityLabel("immunity")}</option>
                <option value="vulnerability">{damageAffinityLabel("vulnerability")}</option>
              </select>
              <select
                className={selectClassName}
                value={entry.damageType}
                aria-label="Tipo de dano"
                onChange={(event) => patch(index, { damageType: event.target.value as DamageType })}
              >
                {DAMAGE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                className={selectClassName}
                value={entry.qualifier ?? "any"}
                aria-label="Qualificador do dano"
                onChange={(event) => patch(index, { qualifier: event.target.value as DamageAffinityQualifier })}
              >
                <option value="any">Qualquer origem</option>
                <option value="nonmagical">Somente não mágico</option>
                <option value="magical">Somente mágico</option>
              </select>
              <Button
                size="icon"
                variant="ghost"
                title="Remover defesa"
                onClick={() => onChange(value.filter((_, current) => current !== index))}
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-textMuted">
          Nenhuma imunidade, resistência ou vulnerabilidade configurada.
        </div>
      )}
    </div>
  )
}
