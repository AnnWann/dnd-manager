import { Droplets, Utensils } from "lucide-react"

import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import {
  normalizeLongRestSupplySettings,
  type LongRestSupplyResourceRule,
  type LongRestSupplySettings,
} from "../../../shared/rest/longRestSupplySettings"

export function LongRestSupplySettingsEditor({
  value,
  onChange,
}: {
  value?: LongRestSupplySettings
  onChange: (value: LongRestSupplySettings) => void
}) {
  const settings = normalizeLongRestSupplySettings(value)

  function update(patch: Partial<LongRestSupplySettings>) {
    onChange({ ...settings, ...patch })
  }

  function updateResource(
    key: "food" | "drink",
    patch: Partial<LongRestSupplyResourceRule>,
  ) {
    update({
      [key]: {
        ...settings[key],
        ...patch,
      },
    })
  }

  return (
    <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
      <header className="border-b border-border p-4">
        <h2 className="font-semibold text-textH">
          Suprimentos de descanso longo
        </h2>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Defina quais suprimentos são necessários para um descanso longo
          completo e como eles são apresentados aos jogadores.
        </p>
      </header>

      <div className="grid gap-4 p-4">
        <Toggle
          checked={settings.enabled}
          title="Exigir suprimentos para descanso longo"
          description="Quando desativado, descansos longos completos não consomem comida ou bebida."
          onChange={(enabled) => update({ enabled })}
        />

        {settings.enabled ? (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              <ResourceEditor
                icon={<Utensils className="h-4 w-4" />}
                title="Comida"
                rule={settings.food}
                onChange={(patch) => updateResource("food", patch)}
              />
              <ResourceEditor
                icon={<Droplets className="h-4 w-4" />}
                title="Bebida"
                rule={settings.drink}
                onChange={(patch) => updateResource("drink", patch)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                checked={settings.useRaceMultipliers}
                title="Aplicar consumo racial"
                description="Usa os multiplicadores de comida e bebida configurados na raça do personagem."
                onChange={(useRaceMultipliers) =>
                  update({ useRaceMultipliers })
                }
              />

              <label className="grid gap-1.5 rounded-lg border border-border bg-bg-subtle p-3">
                <span className="text-xs font-semibold text-textH">
                  Se faltarem suprimentos
                </span>
                <Select
                  value={settings.shortageMode}
                  onChange={(event) =>
                    update({
                      shortageMode:
                        event.target.value === "block" ? "block" : "partial",
                    })
                  }
                >
                  <option value="partial">
                    Permitir descanso parcial
                  </option>
                  <option value="block">
                    Bloquear descanso longo
                  </option>
                </Select>
                <span className="text-[11px] leading-4 text-textMuted">
                  Descanso parcial usa a regra atual: recuperação reduzida e
                  exaustão.
                </span>
              </label>
            </div>

            <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs leading-5 text-text">
              Exemplo: para exigir 0,45 kg de comida e 4 L de água de um
              humanoide padrão, deixe 1 porção por descanso em cada recurso,
              use 0,45 kg por porção de comida e 4 L por porção de bebida.
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}

function ResourceEditor({
  icon,
  title,
  rule,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  rule: LongRestSupplyResourceRule
  onChange: (patch: Partial<LongRestSupplyResourceRule>) => void
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <span className="text-sm font-semibold text-textH">{title}</span>
      </div>

      <Toggle
        checked={rule.enabled}
        title={`Exigir ${title.toLocaleLowerCase("pt-BR")}`}
        description="Conta separadamente para determinar se o descanso é completo."
        onChange={(enabled) => onChange({ enabled })}
      />

      {rule.enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Nome exibido
            </span>
            <Input
              value={rule.label}
              onChange={(event) => onChange({ label: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Porções por descanso padrão
            </span>
            <Input
              type="number"
              min={0}
              step="any"
              value={rule.portionsPerStandardRest}
              onChange={(event) =>
                onChange({
                  portionsPerStandardRest: Math.max(
                    0,
                    Number(event.target.value) || 0,
                  ),
                })
              }
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Quantidade física por porção
            </span>
            <Input
              type="number"
              min={0}
              step="any"
              value={rule.amountPerPortion}
              onChange={(event) =>
                onChange({
                  amountPerPortion: Math.max(
                    0,
                    Number(event.target.value) || 0,
                  ),
                })
              }
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Unidade física
            </span>
            <Input
              value={rule.unit}
              placeholder="kg, L, rações..."
              onChange={(event) => onChange({ unit: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </section>
  )
}

function Toggle({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean
  title: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg p-3">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-textH">{title}</span>
        <span className="mt-1 block text-[11px] leading-4 text-textMuted">
          {description}
        </span>
      </span>
    </label>
  )
}
