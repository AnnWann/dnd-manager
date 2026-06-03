import type { Character } from '../features/models/types'
import { CharacterSelector } from '../features/characters/characterSelector'
import { CampaignNotesPanel } from '../features/notes/CampaignNotesPanel'

type Props = {
  characters: Character[]
  activeCharacter: Character
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
  notes: string
  canEditNotes: boolean
  setNotes: (characterId: string, value: string) => void
}

export function NotesView({
  characters,
  activeCharacter,
  setActiveCharacterId,
  addCharacter,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
  notes,
  canEditNotes,
  setNotes,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setActiveCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={disableDelete}
        showOwnerBadge={showOwnerBadge}
      />

      <CampaignNotesPanel
        characterName={activeCharacter.name}
        notes={notes}
        canEdit={canEditNotes}
        onChange={(value) => setNotes(activeCharacter.id, value)}
      />
    </div>
  )
}