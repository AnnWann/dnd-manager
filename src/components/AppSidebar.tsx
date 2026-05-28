import type { ReactNode } from 'react'

type SidebarItem = {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

export function AppSidebar({ items }: { items: SidebarItem[] }) {
  return (
    <aside className="sticky top-0 flex h-full w-16 shrink-0 flex-col border-r border-accentBorder bg-accentBg/70 px-2 py-4 backdrop-blur md:w-20">

      <nav className="flex flex-1 flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={item.onClick}
            className={
              item.active
                ? 'flex h-12 items-center justify-center rounded-xl border border-accentBorder bg-bg text-textH shadow-sm transition hover:bg-[color:var(--social-bg)]'
                : 'flex h-12 items-center justify-center rounded-xl border border-transparent text-text transition hover:border-accentBorder hover:bg-[color:var(--social-bg)]'
            }
          >
            {item.icon}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.75]">
      {children}
    </svg>
  )
}

export function IconSync() {
  return (
    <IconBase>
      <path d="M20 12a8 8 0 0 0-13.3-5.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 12a8 8 0 0 0 13.3 5.9L20 16" />
      <path d="M20 20v-4h-4" />
    </IconBase>
  )
}

export function IconCharacter() {
  return (
    <IconBase>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </IconBase>
  )
}

export function IconSpells() {
  return (
    <IconBase>
      <path d="M12 2 4 8l8 6 8-6-8-6Z" />
      <path d="M4 14l8 6 8-6" />
    </IconBase>
  )
}

export function IconEquipment() {
  return (
    <IconBase>
      <path d="M6 4h12l2 4-8 12L4 8l2-4Z" />
      <path d="M9 4v4" />
      <path d="M15 4v4" />
    </IconBase>
  )
}

export function IconInitiative() {
  return (
    <IconBase>
      <path d="M4 17h16" />
      <path d="M7 13h2" />
      <path d="M11 9h2" />
      <path d="M15 5h2" />
    </IconBase>
  )
}

export function IconBackpack() {
  return (
    <IconBase>
      <path d="M8 7a4 4 0 0 1 8 0" />
      <path d="M6 8h12l1 12H5L6 8Z" />
      <path d="M9 12h6" />
    </IconBase>
  )
}

export function IconCamp() {
  return (
    <IconBase>
      <path d="M3 18h18" />
      <path d="M6 18 12 6l6 12" />
      <path d="M9 18V11h6v7" />
    </IconBase>
  )
}

export function IconNotes() {
  return (
    <IconBase>
      <path d="M7 4h10l2 2v14H5V4h2Z" />
      <path d="M8 9h8" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </IconBase>
  )
}

export function IconDeathSaves() {
  return (
    <IconBase>
      <path d="M12 3 20 7v6c0 4.4-3.4 7.9-8 10-4.6-2.1-8-5.6-8-10V7l8-4Z" />
      <path d="M9 10l6 6" />
      <path d="M15 10l-6 6" />
    </IconBase>
  )
}