import { useState, type ReactNode } from "react"

type SidebarItem = {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

export function AppSidebar({ items }: { items: SidebarItem[] }) {
  const [open, setOpen] = useState(false)

  function handleClick(item: SidebarItem) {
    item.onClick()
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setOpen((value) => !value)}
        className="fixed right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-accentBorder bg-bg text-textH shadow-sm md:hidden"
      >
        <IconMenu />
      </button>

      {open ? (
        <div className="fixed inset-x-0 bottom-0 top-16 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 z-10 flex h-full w-72 max-w-[85vw] flex-col border-l border-accentBorder bg-bg p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-textH">Menu</div>

              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-text"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleClick(item)}
                  className={
                    item.active
                      ? "flex items-center gap-3 rounded-xl border border-accentBorder bg-accentBg px-3 py-3 text-left text-textH shadow-sm"
                      : "flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-text transition hover:border-accentBorder hover:bg-[color:var(--social-bg)]"
                  }
                >
                  <span className="flex h-8 w-8 items-center justify-center">
                    {item.icon}
                  </span>

                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col border-r border-accentBorder bg-accentBg/70 px-2 py-4 backdrop-blur md:flex">
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
                  ? "flex h-12 items-center justify-center rounded-xl border border-accentBorder bg-bg text-textH shadow-sm transition hover:bg-[color:var(--social-bg)]"
                  : "flex h-12 items-center justify-center rounded-xl border border-transparent text-text transition hover:border-accentBorder hover:bg-[color:var(--social-bg)]"
              }
            >
              {item.icon}
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-[1.75]"
    >
      {children}
    </svg>
  )
}

function IconMenu() {
  return (
    <IconBase>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconBase>
  )
}

export function IconSync() {
  return (<IconBase> <path d="M20 12a8 8 0 0 0-13.3-5.9L4 8" /> <path d="M4 4v4h4" /> <path d="M4 12a8 8 0 0 0 13.3 5.9L20 16" /> <path d="M20 20v-4h-4" /> </IconBase>)
} 
export function IconCharacter() { return (<IconBase> <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" /> <path d="M4 20a8 8 0 0 1 16 0" /> </IconBase>) } 
export function IconMagic() { return (<IconBase> <path d="M12 2 4 8l8 6 8-6-8-6Z" /> <path d="M4 14l8 6 8-6" /> </IconBase>) } 
export function IconEquipment() { return (<IconBase> <path d="M6 4h12l2 4-8 12L4 8l2-4Z" /> <path d="M9 4v4" /> <path d="M15 4v4" /> </IconBase>) } 
export function IconInitiative() { return (<IconBase> <path d="M4 17h16" /> <path d="M7 13h2" /> <path d="M11 9h2" /> <path d="M15 5h2" /> </IconBase>) } 
export function IconActions() { return (<IconBase> <path d="M6 18 18 6" /> <path d="M9 6h9v9" /> <path d="M8 16h4" /> <path d="M16 8v4" /> </IconBase>) } 
export function IconBackpack() { return (<IconBase> <path d="M8 7a4 4 0 0 1 8 0" /> <path d="M6 8h12l1 12H5L6 8Z" /> <path d="M9 12h6" /> </IconBase>) } 
export function IconCamp() { return (<IconBase> <path d="M3 18h18" /> <path d="M6 18 12 6l6 12" /> <path d="M9 18V11h6v7" /> </IconBase>) } 
export function IconNotes() { return (<IconBase> <path d="M7 4h10l2 2v14H5V4h2Z" /> <path d="M8 9h8" /> <path d="M8 13h8" /> <path d="M8 17h5" /> </IconBase>) } 
export function IconDeathSaves() { return (<IconBase> <path d="M12 3 20 7v6c0 4.4-3.4 7.9-8 10-4.6-2.1-8-5.6-8-10V7l8-4Z" /> <path d="M9 10l6 6" /> <path d="M15 10l-6 6" /> </IconBase>) }