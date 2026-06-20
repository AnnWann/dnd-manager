import * as React from "react"

import { cn } from "../../lib/cn"

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    invalid?: boolean
  }

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(
  (
    {
      className,
      invalid = false,
      disabled,
      readOnly,
      ...props
    },
    ref,
  ) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        className={cn(
          [
            "min-h-24 w-full resize-y rounded-lg border px-3 py-2",
            "bg-bg text-sm text-textH",
            "placeholder:text-textMuted",
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
            "disabled:resize-none",
            "disabled:bg-bg-subtle",
            "disabled:text-textMuted",
            "disabled:opacity-70",

            "read-only:bg-bg-subtle",
            "read-only:text-text",

            "aria-invalid:border-danger",
            "aria-invalid:ring-danger/20",
            "aria-invalid:focus-visible:border-danger",
            "aria-invalid:focus-visible:ring-danger/25",
          ].join(" "),
          className,
        )}
        {...props}
      />
    )
  },
)

Textarea.displayName = "Textarea"