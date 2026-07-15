import { useMemo, useState } from 'react'
import { ChevronRight, Search, Variable, X } from 'lucide-react'
import type { CustomFormulaVariable } from '../../lib/customSystems'

type Props = {
  variables: CustomFormulaVariable[]
  onSelect: (path: string) => void
  buttonLabel?: string
}

type VariableTree = {
  children: Map<string, VariableTree>
  variables: CustomFormulaVariable[]
}

export function FormulaVariablePicker({
  variables,
  onSelect,
  buttonLabel = 'Selecionar variável',
}: Props) {
  const [open, setOpen] = useState(false)
  const [root, setRoot] = useState<'standard' | 'custom'>('standard')
  const [segments, setSegments] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const categorized = useMemo(() => ({
    standard: variables.filter((entry) => entry.path.startsWith('character.')),
    custom: variables.filter((entry) => !entry.path.startsWith('character.')),
  }), [variables])

  const activeVariables = categorized[root]
  const tree = useMemo(() => buildTree(activeVariables), [activeVariables])
  const node = getNode(tree, segments)
  const searchResults = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return []
    return activeVariables.filter((entry) =>
      entry.path.toLocaleLowerCase('pt-BR').includes(term) ||
      entry.label.toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [activeVariables, search])

  function close() {
    setOpen(false)
    setSearch('')
    setSegments([])
  }

  function choose(path: string) {
    onSelect(path)
    close()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH hover:border-accent hover:bg-accentBg"
      >
        <Variable className="h-4 w-4" />
        {buttonLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Selecionar variável da fórmula"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close()
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="font-semibold text-textH">Selecionar variável</h2>
                <p className="text-xs text-text">Navegue pelos níveis ou pesquise pelo nome.</p>
              </div>
              <button type="button" onClick={close} className="rounded-lg p-2 text-text hover:bg-accentBg" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 md:grid-cols-[190px_minmax(0,1fr)]">
              <aside className="border-b border-border p-3 md:border-b-0 md:border-r">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                  <CategoryButton
                    active={root === 'standard'}
                    label="Padrões"
                    count={categorized.standard.length}
                    onClick={() => {
                      setRoot('standard')
                      setSegments([])
                      setSearch('')
                    }}
                  />
                  <CategoryButton
                    active={root === 'custom'}
                    label="Customizadas"
                    count={categorized.custom.length}
                    onClick={() => {
                      setRoot('custom')
                      setSegments([])
                      setSearch('')
                    }}
                  />
                </div>
              </aside>

              <main className="flex min-h-0 flex-col">
                <div className="border-b border-border p-3">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Search className="h-4 w-4 text-text" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Pesquisar variável"
                      className="min-w-0 flex-1 bg-transparent text-sm text-textH outline-none"
                      autoFocus
                    />
                  </label>

                  {!search ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-text">
                      <button type="button" onClick={() => setSegments([])} className="rounded px-1.5 py-1 hover:bg-accentBg">
                        {root === 'standard' ? 'Padrões' : 'Customizadas'}
                      </button>
                      {segments.map((segment, index) => (
                        <span key={`${segment}-${index}`} className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          <button
                            type="button"
                            onClick={() => setSegments(segments.slice(0, index + 1))}
                            className="rounded px-1.5 py-1 hover:bg-accentBg"
                          >
                            {segment}
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {search ? (
                    <VariableList variables={searchResults} onSelect={choose} empty="Nenhuma variável encontrada." />
                  ) : (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Array.from(node.children.entries()).map(([segment, child]) => (
                          <button
                            key={segment}
                            type="button"
                            onClick={() => setSegments([...segments, segment])}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-left hover:border-accent hover:bg-accentBg"
                          >
                            <div>
                              <div className="font-mono text-sm text-textH">{segment}</div>
                              <div className="mt-1 text-[11px] text-text">{countVariables(child)} variável(is)</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-text" />
                          </button>
                        ))}
                      </div>

                      {node.variables.length ? (
                        <div className={node.children.size ? 'mt-3' : ''}>
                          <VariableList variables={node.variables} onSelect={choose} empty="" />
                        </div>
                      ) : null}

                      {!node.children.size && !node.variables.length ? (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text">
                          Nenhuma variável nesta categoria.
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </main>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function CategoryButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left ${
        active ? 'border-accent bg-accentBg text-textH' : 'border-border text-text hover:bg-accentBg'
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px]">{count} variável(is)</div>
    </button>
  )
}

function VariableList({
  variables,
  onSelect,
  empty,
}: {
  variables: CustomFormulaVariable[]
  onSelect: (path: string) => void
  empty: string
}) {
  if (!variables.length) {
    return empty ? <div className="p-6 text-center text-sm text-text">{empty}</div> : null
  }

  return (
    <div className="grid gap-2">
      {variables.map((variable) => (
        <button
          key={variable.path}
          type="button"
          onClick={() => onSelect(variable.path)}
          className="rounded-lg border border-border p-3 text-left hover:border-accent hover:bg-accentBg"
        >
          <div className="font-medium text-textH">{variable.label}</div>
          <div className="mt-1 break-all font-mono text-xs text-text">{variable.path}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-text">{variable.valueType}</div>
        </button>
      ))}
    </div>
  )
}

function buildTree(variables: CustomFormulaVariable[]): VariableTree {
  const root: VariableTree = { children: new Map(), variables: [] }

  for (const variable of variables) {
    const parts = variable.path.split('.')
    let node = root

    for (const part of parts.slice(0, -1)) {
      const existing = node.children.get(part)
      if (existing) {
        node = existing
      } else {
        const created: VariableTree = { children: new Map(), variables: [] }
        node.children.set(part, created)
        node = created
      }
    }

    node.variables.push(variable)
  }

  return root
}

function getNode(root: VariableTree, segments: string[]): VariableTree {
  let node = root
  for (const segment of segments) {
    const next = node.children.get(segment)
    if (!next) return root
    node = next
  }
  return node
}

function countVariables(node: VariableTree): number {
  let total = node.variables.length
  for (const child of node.children.values()) total += countVariables(child)
  return total
}
