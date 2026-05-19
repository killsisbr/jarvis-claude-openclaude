import {
  getDynamicConfig_CACHED_MAY_BE_STALE,
  getFeatureValue_CACHED_MAY_BE_STALE,
} from '../services/analytics/growthbook.js'
import { isEnvTruthy } from '../utils/envUtils.js'
import { lt } from '../utils/semver.js'

/**
 * Runtime check for bridge mode entitlement.
 *
 * Remote Control is disabled in external builds.
 */
export function isBridgeEnabled(): boolean {
  return false
}

/**
 * Blocking entitlement check for Remote Control.
 *
 * Remote Control is disabled in external builds.
 */
export async function isBridgeEnabledBlocking(): Promise<boolean> {
  return false
}

/**
 * Diagnostic message for why Remote Control is unavailable, or null if
 * it's enabled.
 */
export async function getBridgeDisabledReason(): Promise<string | null> {
  return 'Remote Control is not available in this build.'
}

/**
 * Runtime check for the env-less (v2) REPL bridge path.
 *
 * Env-less bridge is disabled in external builds.
 */
export function isEnvLessBridgeEnabled(): boolean {
  return false
}

/**
 * Kill-switch for the `cse_*` → `session_*` client-side retag shim.
 *
 * The shim exists because compat/convert.go:27 validates TagSession and the
 * claude.ai frontend routes on `session_*`, while v2 worker endpoints hand out
 * `cse_*`. Once the server tags by environment_kind and the frontend accepts
 * `cse_*` directly, flip this to false to make toCompatSessionId a no-op.
 * Defaults to true — the shim stays active until explicitly disabled.
 */
export function isCseShimEnabled(): boolean {
  return false
    ? getFeatureValue_CACHED_MAY_BE_STALE(
        'tengu_bridge_repl_v2_cse_shim_enabled',
        true,
      )
    : true
}

/**
 * Returns an error message if the current CLI version is below the
 * minimum required for the v1 (env-based) Remote Control path, or null if the
 * version is fine. The v2 (env-less) path uses checkEnvLessBridgeMinVersion()
 * in envLessBridgeConfig.ts instead — the two implementations have independent
 * version floors.
 *
 * Uses cached (non-blocking) GrowthBook config. If GrowthBook hasn't
 * loaded yet, the default '0.0.0' means the check passes — a safe fallback.
 */
export function checkBridgeMinVersion(): string | null {
  // Positive pattern — see docs/feature-gating.md.
  // Negative pattern (if (!feature(...)) return) does not eliminate
  // inline string literals from external builds.
  if (false) {
    const config = getDynamicConfig_CACHED_MAY_BE_STALE<{
      minVersion: string
    }>('tengu_bridge_min_version', { minVersion: '0.0.0' })
    if (config.minVersion && lt(MACRO.VERSION, config.minVersion)) {
      return `Your version of OpenClaude (${MACRO.VERSION}) is too old for Remote Control.\nVersion ${config.minVersion} or higher is required. Run \`openclaude update\` to update.`
    }
  }
  return null
}

/**
 * Default for remoteControlAtStartup when the user hasn't explicitly set it.
 *
 * CCR auto-connect is disabled in external builds.
 */
export function getCcrAutoConnectDefault(): boolean {
  return false
}

/**
 * Opt-in CCR mirror mode — disabled in external builds.
 */
export function isCcrMirrorEnabled(): boolean {
  return false
}
