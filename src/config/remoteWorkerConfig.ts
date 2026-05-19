/**
 * Remote Worker Configuration
 *
 * Allows CLI to optionally connect to a remote JARVIS Worker instead of
 * using local processing. Configuration can be set via:
 * - ~/.jarvis/remote-worker-config.json
 * - Environment variables: JARVIS_REMOTE_URL, JARVIS_REMOTE_KEY
 * - CLI flag: --remote-worker <url>
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface RemoteWorkerConfig {
  url: string
  apiKey?: string
  enabled: boolean
}

const CONFIG_FILE = join(homedir(), '.jarvis', 'remote-worker-config.json')

export function loadRemoteWorkerConfig(): RemoteWorkerConfig {
  const config: RemoteWorkerConfig = {
    url: '',
    apiKey: undefined,
    enabled: false
  }

  // 1. Check environment variables (highest priority)
  if (process.env.JARVIS_REMOTE_URL) {
    config.url = process.env.JARVIS_REMOTE_URL
    config.apiKey = process.env.JARVIS_REMOTE_KEY
    config.enabled = true
    return config
  }

  // 2. Check config file
  if (existsSync(CONFIG_FILE)) {
    try {
      const fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      if (fileConfig.workerUrl) {
        config.url = fileConfig.workerUrl
        config.apiKey = fileConfig.apiKey
        config.enabled = true
      }
    } catch {
      // Ignore parse errors, fall through to disabled
    }
  }

  return config
}

export function isRemoteWorkerEnabled(): boolean {
  const config = loadRemoteWorkerConfig()
  return config.enabled && !!config.url
}

export function getRemoteWorkerConfig(): RemoteWorkerConfig | null {
  const config = loadRemoteWorkerConfig()
  return config.enabled ? config : null
}

/**
 * Check if remote worker should be used for this session
 * Can be overridden with --use-local flag to force local processing
 */
export function shouldUseRemoteWorker(args: string[]): boolean {
  // --use-local overrides remote config
  if (args.includes('--use-local')) {
    return false
  }

  return isRemoteWorkerEnabled()
}
