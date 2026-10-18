export function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}