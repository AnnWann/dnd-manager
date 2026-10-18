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

type CustomSystemIconOption = {
  id: string
  value: string
  label: string
  icon: LucideIcon
}

export const CUSTOM_SYSTEM_ICON_OPTIONS: CustomSystemIconOption[] = [
  { id: 'settings', value: '⚙️', label: 'Sistema', icon: Settings2 },
  { id: 'swords', value: '⚔️', label: 'Combate', icon: Swords },
  { id: 'shield', value: '🛡️', label: 'Defesa', icon: Shield },
  { id: 'target', value: '🎯', label: 'Precisão', icon: Target },
  { id: 'sparkles', value: '✨', label: 'Magia', icon: Sparkles },
  { id: 'wand', value: '🪄', label: 'Feitiçaria', icon: WandSparkles },
  { id: 'flame', value: '🔥', label: 'Fogo', icon: Flame },
  { id: 'zap', value: '⚡', label: 'Energia', icon: Zap },
  { id: 'book', value: '📖', label: 'Conhecimento', icon: BookOpen },
  { id: 'dices', value: '🎲', label: 'Dados', icon: Dices },
  { id: 'heart', value: '❤️', label: 'Vida', icon: Heart },
  { id: 'brain', value: '🧠', label: 'Mente', icon: Brain },
  { id: 'activity', value: '📈', label: 'Condição', icon: Activity },
  { id: 'eye', value: '👁️', label: 'Percepção', icon: Eye },
  { id: 'footprints', value: '👣', label: 'Movimento', icon: Footprints },
  { id: 'crown', value: '👑', label: 'Autoridade', icon: Crown },
  { id: 'gem', value: '💎', label: 'Recurso', icon: Gem },
  { id: 'skull', value: '💀', label: 'Morte', icon: Skull },
  { id: 'leaf', value: '🍃', label: 'Natureza', icon: Leaf },
  { id: 'sun', value: '☀️', label: 'Luz', icon: Sun },
  { id: 'moon', value: '🌙', label: 'Noite', icon: Moon },
  { id: 'star', value: '⭐', label: 'Especial', icon: Star },
]

export function getCustomSystemIconComponent(icon?: string): LucideIcon {
  return findIconOption(icon)?.icon ?? Settings2
}

export function CustomSystemIcon({
  icon,
  className = 'h-5 w-5',
}: {
  icon?: string
  className?: string
}) {
  const option = findIconOption(icon)
  if (option) {
    const Icon = option.icon
    return <Icon className={className} aria-hidden="true" />
  }

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
  const selected = findIconOption(value)
  const isLegacyValue = Boolean(value?.trim() && !selected)

  return (
    <fieldset className="grid gap-3 md:col-span-2">
      <div>
        <legend className="label">Ícone do sistema</legend>
        <p className="mt-1 text-xs text-text">
          O ícone aparece no catálogo, no editor e no conteúdo do personagem.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11">
        {CUSTOM_SYSTEM_ICON_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = selected?.id === option.id

          return (
            <button
              key={option.id}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
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
            Ícone personalizado preservado: <CustomSystemIcon icon={value} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
    </fieldset>
  )
}

function findIconOption(icon?: string): CustomSystemIconOption | undefined {
  const normalized = icon?.trim().replace(/^lucide:/, '')
  if (!normalized) return undefined

  return CUSTOM_SYSTEM_ICON_OPTIONS.find(
    (option) => option.id === normalized || option.value === normalized,
  )
}
