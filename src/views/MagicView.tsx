import { SpellCreatorModule } from "../features/magic/spellCreator/spellCreatorModule"

export function MagicView() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <SpellCreatorModule />
    </div>
  )
}