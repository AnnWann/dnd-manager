import * as React from "react"
import { cn } from "../../lib/cn"

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-bg shadow-theme-sm",
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full border-b border-border p-4",
        className,
      )}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("min-w-0 max-w-full p-4", className)}
      {...props}
    />
  )
}
