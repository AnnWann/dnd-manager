export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

export function clampStep(value: number, min: number, max: number, step: number): number {
  const v = Number.isFinite(value) ? value : min
  const clamped = Math.max(min, Math.min(max, v))
  const snapped = Math.round(clamped / step) * step
  // Keep one decimal for 1.5m increments (e.g. 4.5), avoid float artifacts.
  return Math.round(snapped * 10) / 10
}

export function formatPtNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10
  const isInt = Math.abs(rounded - Math.round(rounded)) < 1e-9
  const s = isInt ? String(Math.round(rounded)) : String(rounded)
  return s.replace('.', ',')
}
