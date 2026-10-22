import { Select } from "../../components/ui/Select";
import {
  applyCriticalDamageRule,
  criticalFormula,
  CRITICAL_PRESETS,
  validateCriticalFormula,
  type CriticalDamageSettings,
} from "../../shared/session-runtime/criticalDamage";
import type { SessionActionRollResult } from "../../shared/session-runtime/diceRollProtocol";

const labels = {
  standard: "Padrão 5e — dobro dos dados",
  maximum: "Rolagem + máximo",
  floor: "Dobro com piso no máximo normal",
  custom: "Fórmula personalizada",
};
export function CriticalDamageSettingsEditor({
  value,
  onChange,
}: {
  value?: CriticalDamageSettings;
  onChange: (value: CriticalDamageSettings) => void;
}) {
  const current = value ?? { mode: "standard" as const };
  const input = current.formula ?? CRITICAL_PRESETS.floor;
  const formula = current.mode === "custom" ? input : criticalFormula(current);
  const error = validateCriticalFormula(formula);
  const example: Pick<
    SessionActionRollResult,
    "damage" | "damages" | "instances" | "details"
  > = {
    damage: {
      groups: [{ quantity: 2, sides: 8, rolls: [2, 3] }],
      modifier: 4,
      total: 9,
      critical: true,
    },
  };
  if (!error)
    applyCriticalDamageRule(example, { mode: "custom", formula }, () => 1);
  return (
    <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
      <header className="border-b border-border p-4">
        <h2 className="font-semibold text-textH">Dano dos críticos</h2>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Regra da sessão para ataques de personagens e criaturas, incluindo
          magias e dados adicionais. Alterações entram em vigor ao salvar.
        </p>
      </header>
      <div className="grid gap-4 p-4">
        <label className="grid gap-2 text-sm text-textH">
          Comportamento
          <Select
            value={current.mode}
            onChange={(event) => {
              const mode = event.target.value as CriticalDamageSettings["mode"];
              onChange(
                mode === "custom"
                  ? { mode, formula: input }
                  : { mode, formula: current.formula },
              );
            }}
          >
            {Object.entries(labels).map(([mode, label]) => (
              <option key={mode} value={mode}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        {current.mode === "custom" ? (
          <label className="grid gap-2 text-sm text-textH">
            Fórmula do crítico
            <input
              value={input}
              maxLength={240}
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby="critical-formula-help critical-formula-feedback"
              className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 font-mono text-sm"
              onChange={(event) => {
                onChange({ mode: "custom", formula: event.target.value });
              }}
            />
          </label>
        ) : (
          <code className="break-words rounded-lg bg-bg-subtle p-3 text-sm text-textH">
            {formula}
          </code>
        )}
        <p
          id="critical-formula-feedback"
          role={error ? "alert" : "status"}
          className={error ? "text-sm text-danger" : "text-sm text-textMuted"}
        >
          {error ??
            `Exemplo de 1d8 + 4: com resultados 2 e 3, o crítico fica em ${example.damage?.total}. Dados extras do exemplo usam resultado 1.`}
        </p>
        {current.mode === "custom" ? (
          <div
            id="critical-formula-help"
            className="grid gap-3 text-xs leading-5 text-textMuted"
          >
            <p>
              A fórmula usa a mesma notação de dados: <code>1d6</code>,{" "}
              <code>2d8</code>, números, <code>+</code>, <code>-</code> e
              parênteses. Multiplicação e divisão aceitam números constantes,
              como <code>roll(dice) * 2</code>.
            </p>
            <dl className="grid gap-2">
              <div>
                <dt className="font-mono text-textH">dice</dt>
                <dd>
                  Todos os dados originais que participam do crítico neste
                  acerto: arma ou magia e adicionais como Hex, Furtivo e Smite.
                  Use dentro de roll ou maxDice.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-textH">mod</dt>
                <dd>
                  Soma dos modificadores fixos. Inclua uma vez para manter os
                  bônus normais.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-textH">
                  roll(dice) / roll(dice, 2)
                </dt>
                <dd>
                  Rola os dados originais uma vez / com a quantidade dobrada.
                  Cada chamada usa dados independentes.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-textH">maxDice(dice)</dt>
                <dd>
                  Máximo dos dados originais, sem modificadores. Exemplo: 1d8 +
                  1d6 → 14.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-textH">max(a, b) / min(a, b)</dt>
                <dd>
                  Escolhe o maior / menor dos dois resultados. max cria um piso;
                  min cria um teto.
                </dd>
              </div>
            </dl>
            <div className="grid gap-2">
              {Object.entries(CRITICAL_PRESETS).map(([key, preset]) => (
                <div key={key}>
                  <span>{labels[key as keyof typeof CRITICAL_PRESETS]}: </span>
                  <code className="break-words text-textH">{preset}</code>
                </div>
              ))}
            </div>
            <p>
              Exemplo extra: <code>roll(dice, 2) + 1d6 + mod</code>. Dados e
              números extras usam o tipo de dano do primeiro componente crítico.
              Os tipos de dano originais são preservados; max/min escolhem o
              conjunto inteiro, sem pisos separados. Cada ataque de uma magia é
              calculado separadamente. Resultados fracionários arredondam para
              baixo por componente; dano negativo vira zero. Limites: 240
              caracteres, multiplicador de roll de 1 a 4. Fórmulas inválidas
              impedem salvar.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
