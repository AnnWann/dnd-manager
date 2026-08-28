from pathlib import Path

path = Path("src/features/characters/customSystems/CustomSystemsTab.tsx")
text = path.read_text()
start = text.index("function ResourceSection({")
end = text.index("\nfunction AbilityTypeSection({", start)

replacement = r'''function ResourceSection({
  definition,
  state,
  actor,
  resourceId,
  onRun,
}: {
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  actor: CustomSystemActor
  resourceId: string
  onRun: (operation: () => CharacterCustomSystemState) => void
}) {
  const resource = definition.resources.find((entry) => entry.id === resourceId)
  const resourceState = state.resources[resourceId]
  const authoritativeCurrent = resourceState?.current ?? 0
  const [optimisticCurrent, setOptimisticCurrent] = useState<number | null>(null)

  useEffect(() => {
    if (optimisticCurrent === null) return

    const confirmed = authoritativeCurrent === optimisticCurrent
    const timeout = window.setTimeout(
      () => setOptimisticCurrent(null),
      confirmed ? 400 : 3000,
    )
    return () => window.clearTimeout(timeout)
  }, [authoritativeCurrent, optimisticCurrent])

  if (!resource || !resourceState) return null

  const maximum = resourceState.maximum ?? resource.maximum
  const displayedCurrent = optimisticCurrent ?? authoritativeCurrent
  const canEdit =
    resource.allowManualAdjustment !== false &&
    !(resource.editPermission === 'masterOnly' && actor !== 'master')
  const canDecrease =
    canEdit && (resource.minimum === undefined || displayedCurrent > resource.minimum)
  const canIncrease =
    canEdit && (maximum === undefined || displayedCurrent < maximum)

  function stageAdjustment(amount: number) {
    const next = clampResourceValue(
      displayedCurrent + amount,
      resource.minimum,
      maximum,
    )
    if (next === displayedCurrent) return
    setOptimisticCurrent(next)
    onRun(() => adjustCustomResource(definition, state, resource.id, amount, actor))
  }

  function stageSet(value: number) {
    const next = clampResourceValue(value, resource.minimum, maximum)
    setOptimisticCurrent(next)
    onRun(() =>
      setCustomResourceCurrent(
        definition,
        state,
        resource.id,
        next,
        actor,
      ),
    )
  }

  function stageReset() {
    const nextState = resetCustomResource(definition, state, resource.id, actor)
    const nextCurrent = nextState.resources[resource.id]?.current
    if (typeof nextCurrent === 'number') setOptimisticCurrent(nextCurrent)
    onRun(() => nextState)
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-textH">{resource.name}</h3>
          {resource.description ? (
            <p className="mt-1 text-xs text-text">{resource.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          title="Restaurar valor inicial"
          disabled={!canEdit}
          onClick={stageReset}
          className="rounded-lg p-1.5 text-text hover:bg-[color:var(--social-bg)] disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!canDecrease}
          onClick={() => stageAdjustment(-1)}
          className="h-9 w-9 rounded-lg border border-border text-lg text-textH disabled:opacity-40"
        >
          −
        </button>
        <BufferedNumberInput
          value={displayedCurrent}
          min={resource.minimum}
          max={maximum}
          disabled={!canEdit}
          onCommit={stageSet}
          className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-center text-textH"
        />
        <button
          type="button"
          disabled={!canIncrease}
          onClick={() => stageAdjustment(1)}
          className="h-9 w-9 rounded-lg border border-border text-lg text-textH disabled:opacity-40"
        >
          +
        </button>
      </div>
      {maximum !== undefined ? (
        <div className="mt-2 text-center text-xs text-text">Máximo: {maximum}</div>
      ) : null}
    </section>
  )
}

function clampResourceValue(value: number, minimum?: number, maximum?: number): number {
  const lowerBounded = minimum === undefined ? value : Math.max(minimum, value)
  return maximum === undefined ? lowerBounded : Math.min(maximum, lowerBounded)
}
'''

path.write_text(text[:start] + replacement + text[end:])
