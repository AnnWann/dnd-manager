import { Select } from "../../../../components/ui/Select"
import { CLASS_OPTIONS } from "../../../../contexts/consts"
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

const MAX_TOTAL_LEVEL = 20
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
  const totalLevel = classes.reduce(
    (total, classData) => total + (classData.level ?? 0),
    0,
  )
  const canAddClass = totalLevel < MAX_TOTAL_LEVEL

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="shrink-0 text-sm font-medium text-textH">Classes</div>
          <div className="mt-1 text-xs text-textMuted">
            Nível total {totalLevel}/{MAX_TOTAL_LEVEL}
          </div>
        </div>

        <Select
          className="h-9 w-auto px-2 text-xs"
          defaultValue=""
          disabled={!canAddClass}
          title={
            canAddClass
              ? "Adicionar classe"
              : "O nível total máximo é 20"
          }
          onChange={(e) => {
            const value = e.target.value as ClassName | ""

            if (!value) return
            if (!canAddClass) {
              e.currentTarget.value = ""
              return
            }

            updateCharacter(character.get("id"), (c) => {
              const currentClasses = c.get("sheet").classes ?? []
              const currentTotal = currentClasses.reduce(
                (total, classData) => total + (classData.level ?? 0),
                0,
              )

              if (currentTotal >= MAX_TOTAL_LEVEL) return c

              return c.withSheet("classes", [
                ...currentClasses,
                createClass(value),
              ])
            })

            e.currentTarget.value = ""
          }}
        >
          <option value="">
            {canAddClass ? "+ Adicionar classe…" : "Nível máximo atingido"}
          </option>

          {CLASS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {totalLevel > MAX_TOTAL_LEVEL ? (
        <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs leading-5 text-danger">
          O nível total está acima de {MAX_TOTAL_LEVEL}. Reduza os níveis antes
          de salvar novas progressões.
        </div>
      ) : null}

      {classes.length === 0 ? (
        <p className="mt-2 text-xs text-text">
          Adicione pelo menos uma classe.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {classes.map((classData, index) => {
            const otherLevels = totalLevel - (classData.level ?? 0)
            const maxLevelForClass = Math.max(
              1,
              MAX_TOTAL_LEVEL - otherLevels,
            )

            return (
              <SelectClassModule
                key={`${classData.className}-${index}`}
                character={character}
                classData={classData}
                classIndex={index}
                maxLevel={maxLevelForClass}
                updateCharacter={updateCharacter}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
