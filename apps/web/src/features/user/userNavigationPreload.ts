let userNavigationPreload: Promise<void> | null = null

/**
 * Loads the modules reachable from the persistent /user navigation before the
 * interactive user shell is mounted. Dynamic imports are cached by the module
 * loader, so React.lazy resolves without another network waterfall when the
 * user changes sections or opens one of their characters.
 */
export function preloadUserNavigation(): Promise<void> {
  if (userNavigationPreload) return userNavigationPreload

  userNavigationPreload = Promise.all([
    import("../../views/user/UserDashboardView"),
    import("../../views/user/UserCharactersTab"),
    import("../../views/user/UserCharacterDetailView"),
    import("../../views/user/UserCampaignsRouteView"),
    import("../../views/user/UserSpellsTab"),
    import("../magic/UserMagicRouteBoundary"),
  ])
    .then(() => undefined)
    .catch((error) => {
      userNavigationPreload = null
      throw error
    })

  return userNavigationPreload
}
