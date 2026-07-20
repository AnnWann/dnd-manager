import type { AppStateV1 } from '../../lib/remoteState'

type Props = {
  state: AppStateV1
}

/**
 * Automatic bulk projection is intentionally disabled.
 *
 * Relational migration now happens through modular repositories/endpoints so a
 * failure in one domain cannot trigger a serverless error on every state change.
 */
export function RelationalMigrationBridge(_props: Props) {
  return null
}
