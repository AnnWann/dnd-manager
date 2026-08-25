import type { CustomClassRuntimeConfig } from "../../models/characters/customClassConfig"

export type SessionCustomClassOperation = {
  type: "character.class.custom.configure"
  characterId: string
  config: CustomClassRuntimeConfig
}

export type SessionCustomClassClientMessage = {
  type: "session.custom-class.operation"
  operation: SessionCustomClassOperation
}
