import {
  Backpack,
  BookOpen,
  Flame,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gem,
  Menu,
  NotebookText,
  RefreshCw,
  ShieldX,
  Sparkles,
  Swords,
  UserRound,
  X,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { cn } from "../lib/cn"

type SidebarItem = {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

type AppSidebarProps = {
  items: SidebarItem[]
}

export function AppSidebar({ items }: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  function handleItemClick(item: SidebarItem) {
    item.onClick()
    setMobileOpen(false)
  }

  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [mobileOpen])

  return (
    <>
      <button
        type="button"
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={mobileOpen}
        aria-controls="mobile-sidebar"
        onClick={() => setMobileOpen((current) => !current)}
        className={cn(
          "fixed right-4 top-4 z-50",
          "flex h-10 w-10 items-center justify-center",
          "rounded-lg border border-border bg-bg",
          "text-textH shadow-theme-sm",
          "transition-colors",
          "hover:border-borderStrong hover:bg-bg-subtle",
          "md:hidden",
        )}
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside
            id="mobile-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Navegação principal"
            className={cn(
              "absolute right-0 top-0 z-10",
              "flex h-full w-72 max-w-[85vw] flex-col",
              "border-l border-border bg-bg-elevated",
              "shadow-theme-lg",
            )}
          >
            <div className="flex min-h-18 items-center justify-between border-b border-border px-4">
              <div>
                <div className="font-heading text-lg font-semibold text-textH">
                  D&amp;D Manager
                </div>

                <div className="text-xs text-textMuted">
                  Gerenciador de mesa
                </div>
              </div>

              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center",
                  "rounded-lg border border-transparent",
                  "text-text",
                  "transition-colors",
                  "hover:border-border hover:bg-bg-subtle hover:text-textH",
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <SidebarNavigation
              items={items}
              onItemClick={handleItemClick}
            />
          </aside>
        </div>
      )}

      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border",
          "bg-bg-elevated md:flex",
          "transition-[width] duration-200",
          collapsed ? "w-20" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            collapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate font-heading text-base font-semibold text-textH">
                D&amp;D Manager
              </div>

              <div className="truncate text-xs text-textMuted">
                Gerenciador de mesa
              </div>
            </div>
          )}

          <button
            type="button"
            aria-label={
              collapsed
                ? "Expandir menu lateral"
                : "Recolher menu lateral"
            }
            onClick={() => setCollapsed((current) => !current)}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center",
              "rounded-lg border border-transparent",
              "text-text",
              "transition-colors",
              "hover:border-border hover:bg-bg-subtle hover:text-textH",
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <SidebarNavigation
          items={items}
          collapsed={collapsed}
          onItemClick={(item) => item.onClick()}
        />
      </aside>
    </>
  )
}

type SidebarNavigationProps = {
  items: SidebarItem[]
  collapsed?: boolean
  onItemClick: (item: SidebarItem) => void
}

function SidebarNavigation({
  items,
  collapsed = false,
  onItemClick,
}: SidebarNavigationProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          title={collapsed ? item.label : undefined}
          aria-current={item.active ? "page" : undefined}
          onClick={() => onItemClick(item)}
          className={cn(
            "group relative flex h-11 w-full items-center rounded-lg border",
            "text-sm font-medium transition-colors",
            collapsed
              ? "justify-center px-0"
              : "justify-start gap-3 px-3",
            item.active
              ? "border-accentBorder bg-accentBg text-textH shadow-theme-sm"
              : "border-transparent text-text hover:border-border hover:bg-bg-subtle hover:text-textH",
          )}
        >
          {item.active && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-1/2 h-5 w-0.5",
                "-translate-y-1/2 rounded-r-full bg-accent",
              )}
            />
          )}

          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center",
              "[&>svg]:h-5 [&>svg]:w-5",
              item.active
                ? "text-accent"
                : "text-textMuted group-hover:text-textH",
            )}
          >
            {item.icon}
          </span>

          {!collapsed && (
            <span className="truncate">
              {item.label}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

export {
  RefreshCw as IconSync,
  UserRound as IconCharacter,
  Sparkles as IconMagic,
  Gem as IconEquipment,
  ClipboardList as IconInitiative,
  BookOpen as IconCompendium,
  Swords as IconActions,
  Backpack as IconBackpack,
  Flame as IconCamp,
  NotebookText as IconNotes,
  ShieldX as IconDeathSaves,
}
