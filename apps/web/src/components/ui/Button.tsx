import * as React from "react"
import { cn } from "../../lib/cn"

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"

type Size = "sm" | "md" | "lg" | "icon"

export type ButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    size?: Size
    loading?: boolean
  }

export function Button({
  className,
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const base = [
    "inline-flex shrink-0 items-center justify-center gap-2",
    "rounded-lg border font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform]",
    "duration-150",
    "select-none",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-accent",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-[color:var(--surface-app)]",
    "active:translate-y-px",
    "disabled:pointer-events-none",
    "disabled:opacity-50",
  ].join(" ")

  const variants: Record<Variant, string> = {
    primary: [
      "border-accent",
      "bg-accent",
      "text-white",
      "shadow-theme-sm",
      "hover:border-accentHover",
      "hover:bg-accentHover",
      "active:bg-[color:var(--accent-pressed)]",
    ].join(" "),

    secondary: [
      "border-border",
      "bg-bg",
      "text-textH",
      "shadow-theme-sm",
      "hover:border-borderStrong",
      "hover:bg-bg-subtle",
      "active:bg-[color:var(--surface-active)]",
    ].join(" "),

    outline: [
      "border-accentBorder",
      "bg-transparent",
      "text-accent",
      "hover:border-accent",
      "hover:bg-accentBg",
      "active:bg-[color:var(--accent-surface-hover)]",
    ].join(" "),

    ghost: [
      "border-transparent",
      "bg-transparent",
      "text-textH",
      "shadow-none",
      "hover:bg-bg-subtle",
      "active:bg-[color:var(--surface-active)]",
    ].join(" "),

    danger: [
      "border-danger",
      "bg-danger",
      "text-white",
      "shadow-theme-sm",
      "hover:bg-[color:var(--danger-hover)]",
      "hover:border-[color:var(--danger-hover)]",
    ].join(" "),
  }

  const sizes: Record<Size, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
    icon: "h-10 w-10 p-0",
  }

  return (
    <button
      type={type}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}

      {children}
    </button>
  )
}