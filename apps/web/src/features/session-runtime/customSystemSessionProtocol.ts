import type { JsonValue } from "../../models/customSystems/CustomGenerals"
import type {
  CustomAbilityInstance,
  CustomResourceState,
} from "../../models/customSystems/CustomSystemDefinition"

import type { SessionCustomSystemOperation as SharedOperation, SessionCustomSystemClientMessage as SharedMessage } from "../../../../../packages/session-protocol/src/customSystemOperations"

export type SessionCustomSystemOperation = SharedOperation<JsonValue, CustomResourceState, CustomAbilityInstance>
export type SessionCustomSystemClientMessage = SharedMessage<JsonValue, CustomResourceState, CustomAbilityInstance>
