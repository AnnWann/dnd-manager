import * as React from "react"
import { cn } from "../../lib/cn"

export type InputProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean
  }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      invalid = false,
      disabled,
      readOnly,
      value,
      onBlur,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [numberDraft, setNumberDraft] = React.useState<string | null>(null)
    const isControlledNumberInput = type === "number" && value !== undefined
    const displayedValue = isControlledNumberInput && numberDraft !== null
      ? numberDraft
      : value

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      if (!isControlledNumberInput) {
        onChange?.(event)
        return
      }

      const nextValue = event.target.value
      setNumberDraft(nextValue)

      if (isIncompleteNumberInput(nextValue)) return

      onChange?.(event)
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
      if (isControlledNumberInput) {
        setNumberDraft(null)
      }

      onBlur?.(event)
    }

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        readOnly={readOnly}
        value={displayedValue}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={invalid || undefined}
        className={cn(
          [
            "h-10 w-full min-w-0 max-w-full rounded-lg border px-3",
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
            "disabled:bg-bg-subtle",
            "disabled:text-textMuted",
            "disabled:opacity-70",

            "read-only:bg-bg-subtle",
            "read-only:text-text",

            "aria-invalid:border-danger",
            "aria-invalid:ring-danger/20",
            "aria-invalid:focus-visible:border-danger",
            "aria-invalid:focus-visible:ring-danger/25",

            "file:mr-3",
            "file:border-0",
            "file:bg-transparent",
            "file:text-sm",
            "file:font-medium",
            "file:text-textH",
          ].join(" "),
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = "Input"

function isIncompleteNumberInput(value: string): boolean {
  const trimmed = value.trim()
  return (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "+" ||
    trimmed === "." ||
    trimmed === "-." ||
    trimmed === "+."
  )
}
