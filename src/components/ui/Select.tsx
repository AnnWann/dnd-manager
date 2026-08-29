import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "../../lib/cn"
import "./select.css"

export type SelectProps =
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    invalid?: boolean
  }

type FlatOption = {
  value: string
  label: string
  disabled: boolean
  group?: string
}

type MenuPosition = {
  left: number
  top?: number
  bottom?: number
  width: number
  maxHeight: number
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      invalid = false,
      disabled = false,
      children,
      multiple = false,
      value,
      defaultValue,
      onChange,
      id,
      name,
      required,
      title,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      ...nativeProps
    },
    forwardedRef,
  ) => {
    const nativeRef = React.useRef<HTMLSelectElement | null>(null)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const menuRef = React.useRef<HTMLDivElement | null>(null)
    const listboxId = React.useId()
    const [open, setOpen] = React.useState(false)
    const [activeIndex, setActiveIndex] = React.useState(-1)
    const [position, setPosition] = React.useState<MenuPosition | null>(null)
    const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
      normalizeSingleValue(defaultValue),
    )

    React.useImperativeHandle(forwardedRef, () => nativeRef.current as HTMLSelectElement)

    const options = React.useMemo(() => flattenOptions(children), [children])
    const selectedValue = value === undefined
      ? uncontrolledValue
      : normalizeSingleValue(value)
    const selectedIndex = options.findIndex((option) => option.value === selectedValue)
    const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

    const updatePosition = React.useCallback(() => {
      const trigger = triggerRef.current
      if (!trigger || typeof window === "undefined") return

      const rect = trigger.getBoundingClientRect()
      const viewportPadding = 8
      const gap = 6
      const minMenuHeight = 160
      const maxMenuHeight = 320
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap
      const spaceAbove = rect.top - viewportPadding - gap
      const openBelow = spaceBelow >= minMenuHeight || spaceBelow >= spaceAbove
      const maxHeight = Math.max(
        96,
        Math.min(maxMenuHeight, openBelow ? spaceBelow : spaceAbove),
      )
      const width = Math.min(
        Math.max(rect.width, 180),
        window.innerWidth - viewportPadding * 2,
      )
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
      )

      setPosition({
        left,
        width,
        maxHeight,
        ...(openBelow
          ? { top: rect.bottom + gap }
          : { bottom: window.innerHeight - rect.top + gap }),
      })
    }, [])

    React.useEffect(() => {
      if (!open) return
      updatePosition()

      const handleViewportChange = () => updatePosition()
      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node | null
        if (
          target &&
          !triggerRef.current?.contains(target) &&
          !menuRef.current?.contains(target)
        ) {
          setOpen(false)
        }
      }

      window.addEventListener("resize", handleViewportChange)
      window.addEventListener("scroll", handleViewportChange, true)
      document.addEventListener("pointerdown", handlePointerDown)

      return () => {
        window.removeEventListener("resize", handleViewportChange)
        window.removeEventListener("scroll", handleViewportChange, true)
        document.removeEventListener("pointerdown", handlePointerDown)
      }
    }, [open, updatePosition])

    React.useEffect(() => {
      if (!open) return
      const nextIndex = selectedIndex >= 0
        ? selectedIndex
        : firstEnabledIndex(options)
      setActiveIndex(nextIndex)
      requestAnimationFrame(() => menuRef.current?.focus())
    }, [open, options, selectedIndex])

    React.useEffect(() => {
      if (!open || activeIndex < 0) return
      document
        .getElementById(`${listboxId}-option-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" })
    }, [activeIndex, listboxId, open])

    function emitChange(nextValue: string) {
      if (value === undefined) setUncontrolledValue(nextValue)

      const select = nativeRef.current
      if (!select) return

      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set
      valueSetter?.call(select, nextValue)
      select.dispatchEvent(new Event("change", { bubbles: true }))
    }

    function choose(index: number) {
      const option = options[index]
      if (!option || option.disabled || disabled) return
      emitChange(option.value)
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }

    function moveActive(direction: 1 | -1) {
      if (!options.length) return
      let next = activeIndex
      for (let attempts = 0; attempts < options.length; attempts += 1) {
        next = (next + direction + options.length) % options.length
        if (!options[next]?.disabled) {
          setActiveIndex(next)
          return
        }
      }
    }

    function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        setOpen(true)
        return
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Escape" || event.key === "Tab") {
        if (event.key === "Escape") event.preventDefault()
        setOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        moveActive(1)
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        moveActive(-1)
        return
      }
      if (event.key === "Home") {
        event.preventDefault()
        setActiveIndex(firstEnabledIndex(options))
        return
      }
      if (event.key === "End") {
        event.preventDefault()
        setActiveIndex(lastEnabledIndex(options))
        return
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        choose(activeIndex)
      }
    }

    if (multiple) {
      return (
        <div className="relative w-full min-w-0 max-w-full">
          <select
            ref={nativeRef}
            id={id}
            name={name}
            disabled={disabled}
            multiple
            required={required}
            aria-invalid={invalid || undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "min-h-28 w-full min-w-0 max-w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-textH shadow-theme-sm outline-none transition-colors hover:border-borderStrong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-textMuted disabled:opacity-70 aria-invalid:border-danger aria-invalid:ring-danger/20",
              className,
            )}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
            {...nativeProps}
          >
            {children}
          </select>
        </div>
      )
    }

    return (
      <div className="relative w-full min-w-0 max-w-full">
        <select
          ref={nativeRef}
          name={name}
          required={required}
          disabled={disabled}
          value={selectedValue}
          onChange={(event) => {
            if (value === undefined) setUncontrolledValue(event.target.value)
            onChange?.(event)
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
          {...nativeProps}
        >
          {children}
        </select>

        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          title={title}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={invalid || undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            [
              "flex h-10 w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-lg border px-3 text-left",
              "bg-bg text-sm font-medium text-textH shadow-theme-sm",
              "transition-[background-color,border-color,box-shadow] duration-150",
              "border-border hover:border-borderStrong hover:bg-bg-subtle",
              "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
              "disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-textMuted disabled:opacity-70",
              "aria-invalid:border-danger aria-invalid:ring-danger/20",
            ].join(" "),
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-textMuted")}>
            {selected?.label || "Selecione"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0 text-textMuted transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>

        {open && position && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                id={listboxId}
                role="listbox"
                tabIndex={-1}
                aria-activedescendant={
                  activeIndex >= 0
                    ? `${listboxId}-option-${activeIndex}`
                    : undefined
                }
                onKeyDown={handleMenuKeyDown}
                className="fixed z-[1000] overflow-y-auto rounded-xl border border-borderStrong bg-bg-elevated p-1 shadow-theme-lg outline-none"
                style={{
                  left: position.left,
                  top: position.top,
                  bottom: position.bottom,
                  width: position.width,
                  maxHeight: position.maxHeight,
                }}
              >
                {options.map((option, index) => {
                  const isSelected = option.value === selectedValue
                  const isActive = index === activeIndex
                  const previousGroup = index > 0 ? options[index - 1]?.group : undefined
                  const showGroup = Boolean(option.group && option.group !== previousGroup)

                  return (
                    <React.Fragment key={`${option.value}-${index}`}>
                      {showGroup ? (
                        <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-textMuted first:pt-1">
                          {option.group}
                        </div>
                      ) : null}
                      <button
                        id={`${listboxId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                        onClick={() => choose(index)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-accentBg text-textH"
                            : isActive
                              ? "bg-bg-subtle text-textH"
                              : "text-text hover:bg-bg-subtle",
                          option.disabled && "cursor-not-allowed opacity-45",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        <Check
                          aria-hidden="true"
                          className={cn(
                            "h-4 w-4 shrink-0 text-accent",
                            !isSelected && "invisible",
                          )}
                        />
                      </button>
                    </React.Fragment>
                  )
                })}
              </div>,
              document.body,
            )
          : null}
      </div>
    )
  },
)

Select.displayName = "Select"

function normalizeSingleValue(
  value: SelectProps["value"] | SelectProps["defaultValue"],
): string {
  if (Array.isArray(value)) return String(value[0] ?? "")
  return value === undefined || value === null ? "" : String(value)
}

function flattenOptions(children: React.ReactNode): FlatOption[] {
  const result: FlatOption[] = []

  function visit(nodes: React.ReactNode, group?: string) {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children, group)
        return
      }
      if (child.type === "optgroup") {
        const props = child.props as {
          label?: React.ReactNode
          children?: React.ReactNode
        }
        visit(props.children, reactNodeText(props.label))
        return
      }
      if (child.type !== "option") return

      const props = child.props as {
        value?: string | number | readonly string[]
        disabled?: boolean
        children?: React.ReactNode
      }
      const label = reactNodeText(props.children)
      const optionValue = props.value === undefined
        ? label
        : Array.isArray(props.value)
          ? String(props.value[0] ?? "")
          : String(props.value)

      result.push({
        value: optionValue,
        label,
        disabled: Boolean(props.disabled),
        group,
      })
    })
  }

  visit(children)
  return result
}

function reactNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(reactNodeText).join("")
  if (React.isValidElement(node)) {
    return reactNodeText((node.props as { children?: React.ReactNode }).children)
  }
  return ""
}

function firstEnabledIndex(options: FlatOption[]): number {
  return options.findIndex((option) => !option.disabled)
}

function lastEnabledIndex(options: FlatOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index
  }
  return -1
}
