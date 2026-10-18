/** Shared operation envelope; application model types are injected by consumers. */
export type SessionCustomClassOperation<TConfig, TClassName> = {
  type: "character.class.custom.configure"
  characterId: string
  /** Optional during the rolling frontend/Worker upgrade; omitted legacy messages target the first custom class. */
  className?: TClassName
  config: TConfig
}

export type SessionCustomClassClientMessage<TConfig, TClassName> = {
  type: "session.custom-class.operation"
  operation: SessionCustomClassOperation<TConfig, TClassName>
}
