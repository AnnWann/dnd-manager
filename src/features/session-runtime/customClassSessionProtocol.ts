import type { CustomClassRuntimeConfig } from "../../models/characters/customClassConfig"
import type { ClassName } from "../../models/sheet/Class"

export type SessionCustomClassOperation = {
  type: "character.class.custom.configure"
  characterId: string
  /** Optional during the rolling frontend/Worker upgrade; omitted legacy messages target the first custom class. */
  className?: ClassName
  config: CustomClassRuntimeConfig
}

export type SessionCustomClassClientMessage = {
  type: "session.custom-class.operation"
  operation: SessionCustomClassOperation
}
