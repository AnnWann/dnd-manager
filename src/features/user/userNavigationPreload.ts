let userNavigationPreload: Promise<void> | null = null

/**
 * Loads the modules reachable from the persistent /user sidebar before the
 * interactive user shell is mounted. Dynamic imports are cached by the module
 * loader, so the React.lazy imports in Router resolve without another network
 * waterfall when the user changes sections.
 */
export function preloadUserNavigation(): Promise<void> {
  if (userNavigationPreload) return userNavigationPreload

  userNavigationPreload = Promise.all([
    import("../../views/user/UserDashboardView"),
    import("../../views/user/UserCharactersTab"),
    import("../../views/user/UserCampaignsRouteView"),
    import("../../views/user/UserSpellsTab"),
  ])
    .then(() => undefined)
    .catch((error) => {
      userNavigationPreload = null
      throw error
    })

  return userNavigationPreload
}
