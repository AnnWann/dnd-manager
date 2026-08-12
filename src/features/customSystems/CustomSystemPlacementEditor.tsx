import { EyeOff, LayoutPanelTop, PanelTop, Rows3 } from 'lucide-react'
import { Select } from '../../components/ui/Select'
import type {
  CustomSystemCharacterPlacement,
  CustomSystemDefinition,
  CustomSystemEmbeddedReference,
  CustomSystemExistingCharacterTab,
  CustomSystemPlacementReference,
} from '../../models/customSystems/CustomSystemDefinition'

export const EXISTING_CHARACTER_TABS: Array<{
  value: CustomSystemExistingCharacterTab
  label: string
}> = [
  { value: 'sheet', label: 'Ficha' },
  { value: 'abilities', label: 'Habilidades' },
  { value: 'spellsList', label: 'Magias' },
  { value: 'equipment', label: 'Equipamento' },
  { value: 'inventory', label: 'Inventário' },
  { value: 'race', label: 'Raça' },
  { value: 'profile', label: 'Perfil' },
  { value: 'proficiencies', label: 'Proficiências' },
]

export const DEFAULT_CUSTOM_SYSTEM_PLACEMENT: CustomSystemCharacterPlacement = {
  mode: 'existingTab',
  targetTab: 'sheet',
  reference: { type: 'content' },
  position: 'after',
}

export function getCustomSystemPlacement(
  definition: CustomSystemDefinition,
): CustomSystemCharacterPlacement {
  const placement =
    definition.characterPlacement ??
    definition.automaticInstallation?.characterPlacement

  if (placement?.mode === 'none') {
    return { mode: 'none' }
  }

  if (placement?.mode === 'newTab') {
    const legacyTab = placement.relativeToTab
    return {
      mode: 'newTab',
      tabLabel: placement.tabLabel?.trim() || undefined,
      reference: normalizeTabReference(
        placement.reference ??
          (legacyTab ? { type: 'standardTab', tab: legacyTab } : undefined),
      ),
      position: placement.position === 'before' ? 'before' : 'after',
    }
  }

  if (placement?.mode === 'existingTab') {
    return {
      mode: 'existingTab',
      targetTab: isExistingTab(placement.targetTab)
        ? placement.targetTab
        : 'sheet',
      reference: normalizeEmbeddedReference(placement.reference),
      position: placement.position === 'before' ? 'before' : 'after',
    }
  }

  return DEFAULT_CUSTOM_SYSTEM_PLACEMENT
}

export function CustomSystemPlacementEditor({
  draft,
  setDraft,
  definitions,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
  definitions: CustomSystemDefinition[]
}) {
  const placement = getCustomSystemPlacement(draft)
  const otherDefinitions = definitions.filter(
    (definition) => definition.id !== draft.id,
  )

  function setPlacement(next: CustomSystemCharacterPlacement) {
    const automaticInstallation = draft.automaticInstallation ?? {
      enabled: false,
      match: 'all' as const,
      requirements: [],
    }

    setDraft({
      ...draft,
      characterPlacement: next,
      automaticInstallation: {
        ...automaticInstallation,
        characterPlacement: next,
      },
    })
  }

  const newTabSystems = otherDefinitions.filter(
    (definition) => getCustomSystemPlacement(definition).mode === 'newTab',
  )

  const embeddedSystems =
    placement.mode === 'existingTab'
      ? otherDefinitions.filter((definition) => {
          const candidate = getCustomSystemPlacement(definition)
          return (
            candidate.mode === 'existingTab' &&
            candidate.targetTab === placement.targetTab
          )
        })
      : []

  return (
    <section className="mt-5 rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent">
          <LayoutPanelTop className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-textH">Exibição na ficha</h3>
          <p className="mt-1 text-sm text-text">
            Escolha onde este sistema será mostrado para personagens que o
            possuírem.
          </p>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-bg p-4 text-sm text-text">
        <input
          type="checkbox"
          className="mt-1"
          checked={draft.hiddenFromSheet === true}
          onChange={(event) =>
            setDraft({ ...draft, hiddenFromSheet: event.target.checked || undefined })
          }
        />
        <span>
          <span className="block font-medium text-textH">Sistema oculto na ficha</span>
          <span className="mt-1 block text-xs leading-5 text-textMuted">
            Campos, recursos, automações, fórmulas e regras continuam ativos, mas o sistema não cria aba, seção nem ações próprias na ficha.
          </span>
        </span>
      </label>

      <div className={`mt-4 grid gap-3 md:grid-cols-3 ${draft.hiddenFromSheet ? 'pointer-events-none opacity-45' : ''}`}>
        <button
          type="button"
          onClick={() => setPlacement({ mode: 'none' })}
          className={`rounded-xl border p-4 text-left transition-colors ${
            placement.mode === 'none'
              ? 'border-accent bg-accentBg'
              : 'border-border hover:bg-bg'
          }`}
        >
          <EyeOff className="h-5 w-5 text-accent" />
          <div className="mt-2 font-medium text-textH">Nenhum</div>
          <p className="mt-1 text-xs text-text">
            Não cria aba nem seção própria. Regras, recursos, fórmulas e ações continuam funcionando normalmente.
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setPlacement({
              mode: 'newTab',
              tabLabel: draft.name,
              reference: { type: 'standardTab', tab: 'sheet' },
              position: 'after',
            })
          }
          className={`rounded-xl border p-4 text-left transition-colors ${
            placement.mode === 'newTab'
              ? 'border-accent bg-accentBg'
              : 'border-border hover:bg-bg'
          }`}
        >
          <PanelTop className="h-5 w-5 text-accent" />
          <div className="mt-2 font-medium text-textH">Criar uma aba própria</div>
          <p className="mt-1 text-xs text-text">
            O ID do sistema será usado na URL da aba.
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setPlacement({
              mode: 'existingTab',
              targetTab: 'sheet',
              reference: { type: 'content' },
              position: 'after',
            })
          }
          className={`rounded-xl border p-4 text-left transition-colors ${
            placement.mode === 'existingTab'
              ? 'border-accent bg-accentBg'
              : 'border-border hover:bg-bg'
          }`}
        >
          <Rows3 className="h-5 w-5 text-accent" />
          <div className="mt-2 font-medium text-textH">Usar uma aba existente</div>
          <p className="mt-1 text-xs text-text">
            O conteúdo aparece junto de uma seção padrão da ficha.
          </p>
        </button>
      </div>

      {placement.mode === 'none' ? (
        <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-sm text-textMuted">
          O conteúdo próprio do sistema não será renderizado em nenhuma aba. Ações configuradas em <strong className="text-textH">Ficha e ações</strong> continuam disponíveis na seção de ações do personagem.
        </div>
      ) : placement.mode === 'newTab' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="label">Nome exibido</span>
            <input
              className="input-base"
              value={placement.tabLabel ?? ''}
              placeholder={draft.name}
              onChange={(event) =>
                setPlacement({
                  ...placement,
                  tabLabel: event.target.value || undefined,
                })
              }
            />
            <span className="text-xs text-text">
              A rota usa <code>{draft.id}</code>.
            </span>
          </label>

          <label className="grid gap-1">
            <span className="label">Posicionar em relação a</span>
            <Select
              value={encodeTabReference(placement.reference)}
              onChange={(event) =>
                setPlacement({
                  ...placement,
                  reference: decodeTabReference(event.target.value),
                })
              }
            >
              <optgroup label="Abas padrão">
                {EXISTING_CHARACTER_TABS.map((entry) => (
                  <option key={entry.value} value={`tab:${entry.value}`}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
              {newTabSystems.length ? (
                <optgroup label="Sistemas em abas próprias">
                  {newTabSystems.map((definition) => (
                    <option
                      key={definition.id}
                      value={`system:${definition.id}`}
                    >
                      {definition.name} ({definition.id})
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </label>

          <label className="grid gap-1">
            <span className="label">Posição</span>
            <Select
              value={placement.position ?? 'after'}
              onChange={(event) =>
                setPlacement({
                  ...placement,
                  position: event.target.value as 'before' | 'after',
                })
              }
            >
              <option value="before">Antes da referência</option>
              <option value="after">Depois da referência</option>
            </Select>
          </label>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="label">Aba de destino</span>
            <Select
              value={placement.targetTab}
              onChange={(event) =>
                setPlacement({
                  mode: 'existingTab',
                  targetTab: event.target
                    .value as CustomSystemExistingCharacterTab,
                  reference: { type: 'content' },
                  position: 'after',
                })
              }
            >
              {EXISTING_CHARACTER_TABS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1">
            <span className="label">Posicionar em relação a</span>
            <Select
              value={encodeEmbeddedReference(placement.reference)}
              onChange={(event) =>
                setPlacement({
                  ...placement,
                  reference: decodeEmbeddedReference(event.target.value),
                })
              }
            >
              <option value="content">Conteúdo padrão da aba</option>
              {embeddedSystems.map((definition) => (
                <option
                  key={definition.id}
                  value={`system:${definition.id}`}
                >
                  {definition.name} ({definition.id})
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1">
            <span className="label">Posição</span>
            <Select
              value={placement.position}
              onChange={(event) =>
                setPlacement({
                  ...placement,
                  position: event.target.value as 'before' | 'after',
                })
              }
            >
              <option value="before">Antes da referência</option>
              <option value="after">Depois da referência</option>
            </Select>
          </label>
        </div>
      )}
    </section>
  )
}

function isExistingTab(value: string): value is CustomSystemExistingCharacterTab {
  return EXISTING_CHARACTER_TABS.some((entry) => entry.value === value)
}

function normalizeTabReference(
  reference: CustomSystemPlacementReference | undefined,
): CustomSystemPlacementReference {
  if (reference?.type === 'system' && reference.systemId.trim()) {
    return { type: 'system', systemId: reference.systemId.trim() }
  }

  if (reference?.type === 'standardTab' && isExistingTab(reference.tab)) {
    return reference
  }

  return { type: 'standardTab', tab: 'sheet' }
}

function normalizeEmbeddedReference(
  reference: CustomSystemEmbeddedReference | undefined,
): CustomSystemEmbeddedReference {
  if (reference?.type === 'system' && reference.systemId.trim()) {
    return { type: 'system', systemId: reference.systemId.trim() }
  }
  return { type: 'content' }
}

function encodeTabReference(reference: CustomSystemPlacementReference | undefined) {
  const normalized = normalizeTabReference(reference)
  return normalized.type === 'system'
    ? `system:${normalized.systemId}`
    : `tab:${normalized.tab}`
}

function decodeTabReference(value: string): CustomSystemPlacementReference {
  if (value.startsWith('system:')) {
    return { type: 'system', systemId: value.slice('system:'.length) }
  }
  const tab = value.slice('tab:'.length)
  return {
    type: 'standardTab',
    tab: isExistingTab(tab) ? tab : 'sheet',
  }
}

function encodeEmbeddedReference(
  reference: CustomSystemEmbeddedReference | undefined,
) {
  const normalized = normalizeEmbeddedReference(reference)
  return normalized.type === 'system'
    ? `system:${normalized.systemId}`
    : 'content'
}

function decodeEmbeddedReference(value: string): CustomSystemEmbeddedReference {
  return value.startsWith('system:')
    ? { type: 'system', systemId: value.slice('system:'.length) }
    : { type: 'content' }
}
