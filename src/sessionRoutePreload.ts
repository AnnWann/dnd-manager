let commonSessionPreload: Promise<void> | null = null
let masterSessionPreload: Promise<void> | null = null

/**
 * Loads every route module a user can reach inside an active session before
 * CampaignLayout releases its initial loading gate. React.lazy still keeps
 * these chunks out of the general app bundle; entering a session simply warms
 * them once so later tab changes do not suspend on first navigation.
 */
export function preloadSessionRouteModules(isMaster: boolean): Promise<void> {
  const common = commonSessionPreload ??= Promise.all([
    import("./features/session-runtime/SessionRouteOutlet"),
    import("./views/campaign/CampaignCharactersView"),
    import("./views/CharacterRouteViews"),
    import("./views/CharacterCreateView"),
    import("./views/session/SessionCharacterLevelUpView"),
    import("./views/PartyInventoryView"),
    import("./views/GroundInventoryView"),
    import("./views/MissionsView"),
  ]).then(() => undefined)

  if (!isMaster) return common

  const master = masterSessionPreload ??= Promise.all([
    common,
    import("./views/InitiativeRoleView"),
    // InitiativeRoleView has its own nested lazy boundary. A MASTER always
    // resolves to InitiativeView, so warm that chunk as part of session entry.
    import("./views/InitiativeView"),
    import("./features/creation/CreationEditorRouteOutlet"),
    import("./views/session/SessionCreationSettingsView"),
    import("./views/session/SessionCreationRequestsView"),
    import("./views/session/SessionHomebrewView"),
    import("./views/ItemsCompendiumView"),
    import("./views/CreaturesCompendiumView"),
    import("./views/CustomSystemsListView"),
    import("./views/CustomSystemEditorView"),
    import("./views/MagicView"),
  ]).then(() => undefined)

  return master
}
