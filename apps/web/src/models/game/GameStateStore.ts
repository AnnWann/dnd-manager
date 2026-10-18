import type { AppStateV1 } from "../../lib/remoteState"
import type { GameOperationRecord } from "./GameOperation"

export type LocalUiState = {
  activeCharacterId: string
  activeTab?: string
  modal?: string
  search?: string
}

export type SharedGameState = Omit<AppStateV1, "activeCharacterId">

export type GameStateListener = (state: AppStateV1) => void

export interface GameStateStore {
  getState(): AppStateV1
  applyOperation(record: GameOperationRecord): void
  subscribe(listener: GameStateListener): () => void
}

export interface GameSyncProvider {
  connect(roomId: string): Promise<void>
  disconnect(): void
  sendOperation(record: GameOperationRecord): Promise<void>
  onOperation(
    callback: (record: GameOperationRecord) => void,
  ): () => void
}

export function getSharedGameState(state: AppStateV1): SharedGameState {
  const { activeCharacterId: _activeCharacterId, ...shared } = state
  return shared
}

export function getLocalUiState(state: AppStateV1): LocalUiState {
  return {
    activeCharacterId: state.activeCharacterId,
  }
}
