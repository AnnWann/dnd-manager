import { Select } from "../../../../components/ui/Select"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import { CharacterClassBuilder, type ClassName } from "../../../../models/sheet/Class"
import { SelectClassModule } from "./selectClassModule"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

const CLASS_OPTIONS: Array<{ value: ClassName; label: string }> = [
  { value: "artificer", label: "Artífice" },
  { value: "barbarian", label: "Bárbaro" },
  { value: "bard", label: "Bardo" },
  { value: "cleric", label: "Clérigo" },
  { value: "druid", label: "Druida" },
  { value: "fighter", label: "Guerreiro" },
  { value: "monk", label: "Monge" },
  { value: "paladin", label: "Paladino" },
  { value: "ranger", label: "Patrulheiro" },
  { value: "rogue", label: "Ladino" },
  { value: "sorcerer", label: "Feiticeiro" },
  { value: "warlock", label: "Bruxo" },
  { value: "wizard", label: "Mago" },
]

const builder = new CharacterClassBuilder()

function createClass(className: ClassName) {
  return builder[className]()
}

export function Classes({
  character,
  updateCharacter
}: Props) {
  const sheet = character.get("sheet")
  const classes = sheet.classes ?? []

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="shrink-0 text-sm font-medium text-textH">Classes</div>

        <Select
          className="h-9 w-auto px-2 text-xs"
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value as ClassName | ""

            if (!value) return

            updateCharacter(character.get("id"), (c) =>
              c.withSheet("classes", [
                ...(c.get("sheet").classes ?? []),
                createClass(value),
              ]),
            )

            e.currentTarget.value = ""
          }}
        >
          <option value="">+ Adicionar classe…</option>

          {CLASS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {classes.length === 0 ? (
        <p className="mt-2 text-xs text-text">
          Adicione pelo menos uma classe.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {classes.map((classData, index) => (
            <SelectClassModule
              key={`${classData.className}-${index}`}
              character={character}
              classData={classData}
              classIndex={index}
              updateCharacter={updateCharacter}
            />
          ))}
        </div>
      )}
    </div>
  )
}