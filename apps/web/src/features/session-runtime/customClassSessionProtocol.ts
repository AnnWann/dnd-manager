import type { CustomClassRuntimeConfig } from "../../models/characters/customClassConfig"
import type { ClassName } from "../../models/sheet/Class"

import type {
  SessionCustomClassOperation as SharedSessionCustomClassOperation,
  SessionCustomClassClientMessage as SharedSessionCustomClassClientMessage,
} from "../../../../../packages/session-protocol/src/customClassOperations"

export type SessionCustomClassOperation = SharedSessionCustomClassOperation<CustomClassRuntimeConfig, ClassName>
export type SessionCustomClassClientMessage = SharedSessionCustomClassClientMessage<CustomClassRuntimeConfig, ClassName>
