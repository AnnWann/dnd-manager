import { Eye, EyeOff, Gauge, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import {
  normalizeCampaignProgressionSettings,
  type CampaignProgressionSettings,
  type CampaignProgressionTrack,
} from "../../../shared/progression/campaignProgression"

export function CampaignProgressionSettingsEditor({
  value,
  onChange,
}: {
  value?: CampaignProgressionSettings
  onChange: (value: CampaignProgressionSettings) => void
}) {
  const progression = normalizeCampaignProgressionSettings(value)

  function update(patch: Partial<CampaignProgressionSettings>) {
    onChange({ ...progression, ...patch })
  }

  function updateTrack(
    id: string,
    updater: (track: CampaignProgressionTrack) => CampaignProgressionTrack,
  ) {
    update({
      customTracks: (progression.customTracks ?? []).map((track) =>
        track.id === id ? normalizeTrack(updater(track)) : track,
      ),
    })
  }

  function addTrack() {
    update({
      customTracks: [
        ...(progression.customTracks ?? []),
        {
          id: crypto.randomUUID(),
          name: "Nova área",
          description: "",
          current: 0,
          maximum: 100,
          levelUpAt: 80,
          unit: "%",
          revealed: false,
          grantsLevel: true,
        },
      ],
    })
  }

  return (
    <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
      <header className="border-b border-border p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-textH">Progressão de nível</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Escolha como a campanha informa quando os personagens podem subir de nível.
              Objetivos ocultos não são enviados para a visualização dos jogadores.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["xp", "Experiência", "Tabela padrão de XP do D&D."],
            ["milestone", "Marcos", "O mestre libera o próximo nível por um marco narrativo."],
            ["custom", "Personalizada", "Use um ou mais medidores próprios da campanha."],
          ].map(([mode, label, description]) => (
            <button
              key={mode}
              type="button"
              className={
                progression.mode === mode
                  ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
                  : "rounded-xl border border-border bg-bg-subtle p-3 text-left hover:border-accentBorder"
              }
              onClick={() =>
                update({
                  mode: mode as CampaignProgressionSettings["mode"],
                  milestone:
                    mode === "milestone"
                      ? progression.milestone ?? {
                          name: "Próximo marco",
                          description: "",
                          revealed: true,
                          levelUpAvailable: false,
                        }
                      : progression.milestone,
                  customTracks:
                    mode === "custom"
                      ? progression.customTracks ?? []
                      : progression.customTracks,
                  title:
                    progression.title
                    ?? (mode === "custom"
                      ? "Exploração"
                      : mode === "milestone"
                        ? "Marcos"
                        : undefined),
                })
              }
            >
              <div className="text-sm font-semibold text-textH">{label}</div>
              <div className="mt-1 text-[11px] leading-4 text-textMuted">
                {description}
              </div>
            </button>
          ))}
        </div>

        {progression.mode === "xp" ? (
          <div className="rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-5 text-textMuted">
            A ficha usa a tabela padrão de experiência. O XP continua sendo armazenado
            individualmente em cada personagem.
          </div>
        ) : null}

        {progression.mode === "milestone" ? (
          <MilestoneEditor progression={progression} onChange={update} />
        ) : null}

        {progression.mode === "custom" ? (
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">Nome da progressão</span>
              <Input
                value={progression.title ?? "Exploração"}
                placeholder="Ex.: Exploração"
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-textH">Medidores personalizados</div>
                <div className="mt-1 text-xs text-textMuted">
                  Cada medidor pode permanecer secreto até o mestre revelá-lo.
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={addTrack}>
                <Plus className="h-4 w-4" />
                Adicionar medidor
              </Button>
            </div>

            {(progression.customTracks ?? []).length ? (
              <div className="grid gap-3">
                {(progression.customTracks ?? []).map((track) => (
                  <TrackEditor
                    key={track.id}
                    track={track}
                    onChange={(next) => updateTrack(track.id, () => next)}
                    onRemove={() =>
                      update({
                        customTracks: (progression.customTracks ?? []).filter(
                          (entry) => entry.id !== track.id,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-7 text-center text-sm text-textMuted">
                Nenhum medidor criado. Para uma campanha de exploração, crie um
                medidor por ilha e revele-o quando o grupo encontrá-la.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function MilestoneEditor({
  progression,
  onChange,
}: {
  progression: CampaignProgressionSettings
  onChange: (patch: Partial<CampaignProgressionSettings>) => void
}) {
  const milestone = progression.milestone ?? {
    name: "Próximo marco",
    description: "",
    revealed: true,
    levelUpAvailable: false,
  }

  function patch(
    next: Partial<NonNullable<CampaignProgressionSettings["milestone"]>>,
  ) {
    onChange({ milestone: { ...milestone, ...next } })
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-4">
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-textH">Título da seção</span>
        <Input
          value={progression.title ?? "Marcos"}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-textH">Próximo marco</span>
        <Input
          value={milestone.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-textH">Descrição</span>
        <Textarea
          rows={2}
          value={milestone.description ?? ""}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleCard
          checked={milestone.revealed}
          title="Visível aos jogadores"
          description="Desative para manter o nome e a descrição do marco secretos."
          onChange={(checked) => patch({ revealed: checked })}
        />
        <ToggleCard
          checked={milestone.levelUpAvailable}
          title="Nível liberado"
          description="Quando ativo, a ficha avisa que este marco já permite subir de nível."
          onChange={(checked) => patch({ levelUpAvailable: checked })}
        />
      </div>
    </div>
  )
}

function TrackEditor({
  track,
  onChange,
  onRemove,
}: {
  track: CampaignProgressionTrack
  onChange: (track: CampaignProgressionTrack) => void
  onRemove: () => void
}) {
  const percent = Math.max(0, Math.min(100, (track.current / Math.max(1, track.maximum)) * 100))
  const thresholdPercent = Math.max(0, Math.min(100, (track.levelUpAt / Math.max(1, track.maximum)) * 100))
  const ready = track.grantsLevel && track.current >= track.levelUpAt

  function patch(next: Partial<CampaignProgressionTrack>) {
    onChange(normalizeTrack({ ...track, ...next }))
  }

  return (
    <article className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={track.name}
            placeholder="Nome do medidor"
            onChange={(event) => patch({ name: event.target.value })}
          />
          <Textarea
            className="mt-2"
            rows={2}
            value={track.description ?? ""}
            placeholder="Descrição opcional"
            onChange={(event) => patch({ description: event.target.value })}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
          Remover
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <NumberField label="Atual" value={track.current} onChange={(value) => patch({ current: value })} />
        <NumberField label="Máximo" value={track.maximum} minimum={1} onChange={(value) => patch({ maximum: value })} />
        <NumberField label="Libera nível em" value={track.levelUpAt} onChange={(value) => patch({ levelUpAt: value })} />
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">Unidade</span>
          <Input value={track.unit} placeholder="%" onChange={(event) => patch({ unit: event.target.value })} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => patch({ current: track.current - 5 })}>−5</Button>
        <Button size="sm" variant="secondary" onClick={() => patch({ current: track.current + 5 })}>+5</Button>
        <Button size="sm" variant="secondary" onClick={() => patch({ current: track.current + 10 })}>+10</Button>
      </div>

      <div className="rounded-lg border border-border bg-bg p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-textH">Prévia: {formatTrackValue(track.current, track.unit)}</span>
          <span className={ready ? "font-semibold text-accent" : "text-textMuted"}>
            {ready ? "Meta atingida — nível liberado" : `Meta: ${formatTrackValue(track.levelUpAt, track.unit)}`}
          </span>
        </div>
        <div className="relative mt-3 h-2 overflow-visible rounded-full bg-bg-subtle">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
          {track.grantsLevel ? (
            <span
              className="absolute top-[-3px] h-3.5 w-0.5 bg-textH"
              style={{ left: `${thresholdPercent}%` }}
              title="Meta para liberar nível"
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleCard
          checked={track.revealed}
          title={track.revealed ? "Visível aos jogadores" : "Oculto dos jogadores"}
          description={
            track.revealed
              ? "O medidor e seu nome são enviados para a ficha dos jogadores."
              : "O nome, a descrição e o progresso não são enviados para os jogadores."
          }
          icon={track.revealed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          onChange={(checked) => patch({ revealed: checked })}
        />
        <ToggleCard
          checked={track.grantsLevel}
          title="Concede nível"
          description="Ao alcançar a meta configurada, a ficha indica que há um nível disponível."
          onChange={(checked) => patch({ grantsLevel: checked })}
        />
      </div>
    </article>
  )
}

function NumberField({
  label,
  value,
  minimum = 0,
  onChange,
}: {
  label: string
  value: number
  minimum?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-textH">{label}</span>
      <Input
        type="number"
        min={minimum}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  )
}

function ToggleCard({
  checked,
  title,
  description,
  icon,
  onChange,
}: {
  checked: boolean
  title: string
  description: string
  icon?: ReactNode
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
        <span className="flex items-center gap-1.5 text-xs font-semibold text-textH">
          {icon}
          {title}
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-textMuted">{description}</span>
      </span>
    </label>
  )
}

function normalizeTrack(track: CampaignProgressionTrack): CampaignProgressionTrack {
  const maximum = Math.max(1, finite(track.maximum, 100))
  return {
    ...track,
    current: clamp(finite(track.current, 0), 0, maximum),
    maximum,
    levelUpAt: clamp(finite(track.levelUpAt, maximum), 0, maximum),
    unit: track.unit.trim() || "%",
  }
}

function formatTrackValue(value: number, unit: string): string {
  const display = Number.isInteger(value)
    ? value.toLocaleString("pt-BR")
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  return unit === "%" ? `${display}%` : `${display} ${unit}`.trim()
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
