import {
  Activity,
  BookOpen,
  Brain,
  Crown,
  Dices,
  Eye,
  Flame,
  Footprints,
  Gem,
  Heart,
  Leaf,
  Moon,
  Settings2,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  WandSparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export type CustomSystemIconId =
  | 'settings'
  | 'swords'
  | 'shield'
  | 'target'
  | 'sparkles'
  | 'wand'
  | 'flame'
  | 'zap'
  | 'book'
  | 'dices'
  | 'heart'
  | 'brain'
  | 'activity'
  | 'eye'
  | 'footprints'
  | 'crown'
  | 'gem'
  | 'skull'
  | 'leaf'
  | 'sun'
  | 'moon'
  | 'star'

type CustomSystemIconOption = {
  id: CustomSystemIconId
  label: string
  icon: LucideIcon
}

export const CUSTOM_SYSTEM_ICON_OPTIONS: CustomSystemIconOption[] = [
  { id: 'settings', label: 'Sistema', icon: Settings2 },
  { id: 'swords', label: 'Combate', icon: Swords },
  { id: 'shield', label: 'Defesa', icon: Shield },
  { id: 'target', label: 'Precisão', icon: Target },
  { id: 'sparkles', label: 'Magia', icon: Sparkles },
  { id: 'wand', label: 'Feitiçaria', icon: WandSparkles },
  { id: 'flame', label: 'Fogo', icon: Flame },
  { id: 'zap', label: 'Energia', icon: Zap },
  { id: 'book', label: 'Conhecimento', icon: BookOpen },
  { id: 'dices', label: 'Dados', icon: Dices },
  { id: 'heart', label: 'Vida', icon: Heart },
  { id: 'brain', label: 'Mente', icon: Brain },
  { id: 'activity', label: 'Condição', icon: Activity },
  { id: 'eye', label: 'Percepção', icon: Eye },
  { id: 'footprints', label: 'Movimento', icon: Footprints },
  { id: 'crown', label: 'Autoridade', icon: Crown },
  { id: 'gem', label: 'Recurso', icon: Gem },
  { id: 'skull', label: 'Morte', icon: Skull },
  { id: 'leaf', label: 'Natureza', icon: Leaf },
  { id: 'sun', label: 'Luz', icon: Sun },
  { id: 'moon', label: 'Noite', icon: Moon },
  { id: 'star', label: 'Especial', icon: Star },
]

const ICONS_BY_ID = new Map(
  CUSTOM_SYSTEM_ICON_OPTIONS.map((option) => [option.id, option.icon]),
)

export function getCustomSystemIconComponent(icon?: string): LucideIcon {
  return ICONS_BY_ID.get(normalizeIconId(icon)) ?? Settings2
}

export function CustomSystemIcon({
  icon,
  className = 'h-5 w-5',
}: {
  icon?: string
  className?: string
}) {
  const normalized = normalizeIconId(icon)
  const Icon = ICONS_BY_ID.get(normalized)

  if (Icon) return <Icon className={className} aria-hidden="true" />

  if (icon?.trim()) {
    return (
      <span className="leading-none" aria-hidden="true">
        {icon}
      </span>
    )
  }

  return <Settings2 className={className} aria-hidden="true" />
}

export function CustomSystemIconPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (icon: string | undefined) => void
}) {
  const selected = normalizeIconId(value)
  const isLegacyValue = Boolean(value?.trim() && !ICONS_BY_ID.has(selected))

  return (
    <fieldset className="grid gap-3 md:col-span-2">
      <div>
        <legend className="label">Ícone do sistema</legend>
        <p className="mt-1 text-xs text-text">
          O ícone aparece no catálogo, no editor e na aba do personagem.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11">
        {CUSTOM_SYSTEM_ICON_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = selected === option.id

          return (
            <button
              key={option.id}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors ${
                active
                  ? 'border-accent bg-accentBg text-textH'
                  : 'border-border bg-bg text-text hover:border-accentBorder hover:bg-bg-subtle hover:text-textH'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate text-[10px]">{option.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg"
        >
          Usar ícone padrão
        </button>

        {isLegacyValue ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-text">
            Ícone antigo preservado: <CustomSystemIcon icon={value} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
    </fieldset>
  )
}

function normalizeIconId(icon?: string): CustomSystemIconId | '' {
  const normalized = icon?.trim().replace(/^lucide:/, '') ?? ''
  return ICONS_BY_ID.has(normalized as CustomSystemIconId)
    ? (normalized as CustomSystemIconId)
    : ''
}
