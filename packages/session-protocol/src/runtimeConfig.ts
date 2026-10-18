export type SessionRuntimeConfigPublishMessage<TSnapshot> = {
  type: "session.config.publish"
  snapshot: TSnapshot
}

export type SessionRuntimeConfigSnapshotMessage<TSnapshot> = {
  type: "session.config.snapshot"
  snapshot: TSnapshot | null
}

export type SessionRuntimeConfigClientMessage<TSnapshot> = SessionRuntimeConfigPublishMessage<TSnapshot>
export type SessionRuntimeConfigServerMessage<TSnapshot> = SessionRuntimeConfigSnapshotMessage<TSnapshot>

