/** Sum permanent ability score increases recorded by ASI entries. */
export function sumAsiAttributeIncreases<TAttribute extends string>(
  entries: ReadonlyArray<{ increases: Partial<Record<TAttribute, number>> }>,
  attribute: TAttribute,
): number {
  return entries.reduce((total, entry) => total + Math.max(0, entry.increases[attribute] ?? 0), 0)
}
