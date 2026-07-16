import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "../../lib/cn"

export type SelectProps =
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    invalid?: boolean
  }

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      invalid = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div className="relative w-full min-w-0 max-w-full">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            [
              "h-10 w-full min-w-0 max-w-full appearance-none rounded-lg border px-3 pr-10",
              "bg-bg text-sm font-medium text-textH",
              "shadow-theme-sm",
              "transition-[background-color,border-color,box-shadow]",
              "duration-150",

              "border-border",
              "hover:border-borderStrong",

              "focus-visible:border-accent",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-accent/25",

              "disabled:cursor-not-allowed",
              "disabled:bg-bg-subtle",
              "disabled:text-textMuted",
              "disabled:opacity-70",

              "aria-invalid:border-danger",
              "aria-invalid:ring-danger/20",
              "aria-invalid:focus-visible:border-danger",
              "aria-invalid:focus-visible:ring-danger/25",

              // Browsers render the opened native list outside the normal Tailwind
              // cascade. Explicit option colors keep it readable in dark themes.
              "[&>option]:bg-[#1b1821]",
              "[&>option]:text-[#f7f2ff]",
              "[&>option]:font-medium",
              "[&>option:disabled]:text-[#8f8799]",
            ].join(" "),
            className,
          )}
          {...props}
        >
          {children}
        </select>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            [
              "pointer-events-none absolute right-3 top-1/2",
              "h-4 w-4 -translate-y-1/2",
              "text-textMuted",
            ].join(" "),
            disabled && "opacity-50",
          )}
        />
      </div>
    )
  },
)

Select.displayName = "Select"
