import type { Attribute } from "../../sheet/Attribute"
import type { SpellSourceType } from "./spellDefinitions"

export type SpellSource = {
  type: SpellSourceType
  name: string
  attribute: Attribute
  sourceId: string
  extendedList?: boolean
}
