import { LayoutPanelTop, PanelTop, Rows3 } from 'lucide-react'
import { Select } from '../../components/ui/Select'
import type {
  CustomSystemCharacterPlacement,
  CustomSystemDefinition,
  CustomSystemExistingCharacterTab,
} from '../../models/customSystems/CustomSystemDefinition'

const EXISTING_TABS: Array<{ value: CustomSystemExistingCharacterTab; label: string }> = [
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
  position: 'after',
}

export function getCustomSystemPlacement(
  definition: CustomSystemDefinition,
): CustomSystemCharacterPlacement {
  const placement = definition.characterPlacement ?? definition.automaticInstallation?.characterPlacement
  if (placement?.mode === 'newTab') {
    return {
      mode: 'newTab',
      tabLabel: placement.tabLabel?.trim() || undefined,
    }
  }
  if (placement?.mode === 'existingTab') {
    return {
      mode: 'existingTab',
      targetTab: EXISTING_TABS.some((entry) => entry.value === placement.targetTab)
        ? placement.targetTab
        : 'sheet',
      position: placement.position === 'before' ? 'before' : 'after',
    }
  }
  return DEFAULT_CUSTOM_SYSTEM_PLACEMENT
}

export function CustomSystemPlacementEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  const placement = getCustomSystemPlacement(draft)

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

  return <section className="mt-5 rounded-xl border border-border bg-bg-subtle p-4">
    <div className="flex items-start gap-3">
      <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent">
        <LayoutPanelTop className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-textH">Exibição na ficha</h3>
        <p className="mt-1 text-sm text-text">
          Escolha onde este sistema será mostrado para personagens que o possuírem.
        </p>
      </div>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <button
        type="button"
        onClick={() => setPlacement({ mode: 'newTab', tabLabel: draft.name })}
        className={`rounded-xl border p-4 text-left transition-colors ${placement.mode === 'newTab' ? 'border-accent bg-accentBg' : 'border-border hover:bg-bg'}`}
      >
        <PanelTop className="h-5 w-5 text-accent" />
        <div className="mt-2 font-medium text-textH">Criar uma aba própria</div>
        <p className="mt-1 text-xs text-text">O sistema ganha um botão próprio na navegação do personagem.</p>
      </button>

      <button
        type="button"
        onClick={() => setPlacement({ mode: 'existingTab', targetTab: 'sheet', position: 'after' })}
        className={`rounded-xl border p-4 text-left transition-colors ${placement.mode === 'existingTab' ? 'border-accent bg-accentBg' : 'border-border hover:bg-bg'}`}
      >
        <Rows3 className="h-5 w-5 text-accent" />
        <div className="mt-2 font-medium text-textH">Usar uma aba existente</div>
        <p className="mt-1 text-xs text-text">O conteúdo aparece junto de uma seção padrão da ficha.</p>
      </button>
    </div>

    {placement.mode === 'newTab' ? <div className="mt-4 grid gap-1 md:max-w-md">
      <label className="label" htmlFor="custom-system-tab-label">Nome da aba</label>
      <input
        id="custom-system-tab-label"
        className="input-base"
        value={placement.tabLabel ?? ''}
        placeholder={draft.name}
        onChange={(event) => setPlacement({ mode: 'newTab', tabLabel: event.target.value || undefined })}
      />
      <span className="text-xs text-text">Quando vazio, usa o nome do sistema.</span>
    </div> : <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="grid gap-1">
        <span className="label">Aba de destino</span>
        <Select
          value={placement.targetTab}
          onChange={(event) => setPlacement({ ...placement, targetTab: event.target.value as CustomSystemExistingCharacterTab })}
        >
          {EXISTING_TABS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </Select>
      </label>

      <label className="grid gap-1">
        <span className="label">Posição dentro da aba</span>
        <Select
          value={placement.position}
          onChange={(event) => setPlacement({ ...placement, position: event.target.value as 'before' | 'after' })}
        >
          <option value="before">Antes de todo o conteúdo padrão</option>
          <option value="after">Depois de todo o conteúdo padrão</option>
        </Select>
      </label>
    </div>}
  </section>
}
