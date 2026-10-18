/** Framework-independent profile operation wire shape. */
export type SessionProfileOperation<TProfile, TBackground> =
  | { type: "character.profile.replace"; characterId: string; profile: TProfile }
  | { type: "character.profile.background.save"; characterId: string; background: TBackground; addEquipment: boolean }
  | { type: "character.profile.background.remove"; characterId: string }

export type SessionProfileClientMessage<TProfile, TBackground> = {
  type: "session.profile.operation"
  operation: SessionProfileOperation<TProfile, TBackground>
}
