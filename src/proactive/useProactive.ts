/**
 * React hook for proactive mode state.
 */

import { useSyncExternalStore } from 'react'
import {
  isProactiveActive,
  isProactivePaused,
  getNextTickAt,
  subscribeToProactiveChanges,
} from './index.js'

export function useProactive() {
  const active = useSyncExternalStore(
    subscribeToProactiveChanges,
    isProactiveActive,
    () => false,
  )
  const paused = useSyncExternalStore(
    subscribeToProactiveChanges,
    isProactivePaused,
    () => false,
  )
  const nextTick = useSyncExternalStore(
    subscribeToProactiveChanges,
    getNextTickAt,
    () => null,
  )

  return { active, paused, nextTick }
}
