/**
 * Mutex — Mutual Exclusion Lock
 *
 * Thread-safe locking for concurrent access control
 * Adapted from KimiProxy src/services/playwright.ts
 */

export class Mutex {
  private queue: (() => void)[] = []
  private locked = false

  /**
   * Acquire the lock
   *
   * @returns Resolver function to release the lock
   */
  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true
      return () => this.release()
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        resolve(() => this.release())
      })
    })
  }

  /**
   * Release the lock and process next in queue
   */
  private release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.locked = false
    }
  }

  /**
   * Check if lock is currently held
   */
  isLocked(): boolean {
    return this.locked || this.queue.length > 0
  }

  /**
   * Get queue size (for debugging)
   */
  getQueueSize(): number {
    return this.queue.length
  }
}

/**
 * Acquire lock with timeout
 *
 * @param mutex - Mutex instance
 * @param timeoutMs - Timeout in milliseconds
 * @returns Release function or null if timeout
 */
export async function acquireWithTimeout(
  mutex: Mutex,
  timeoutMs: number = 5000
): Promise<(() => void) | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs)
  })

  const result = await Promise.race([
    mutex.acquire(),
    timeoutPromise,
  ])

  return result
}

/**
 * Safely execute function with mutex lock
 *
 * @param mutex - Mutex instance
 * @param fn - Function to execute
 * @returns Result of function
 */
export async function withLock<T>(
  mutex: Mutex,
  fn: () => Promise<T>
): Promise<T> {
  const release = await mutex.acquire()
  try {
    return await fn()
  } finally {
    release()
  }
}

/**
 * Safely execute function with timeout
 *
 * @param mutex - Mutex instance
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Result or throws on timeout
 */
export async function withLockTimeout<T>(
  mutex: Mutex,
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  const release = await acquireWithTimeout(mutex, timeoutMs)
  if (!release) {
    throw new Error(`Lock acquisition timeout after ${timeoutMs}ms`)
  }

  try {
    return await fn()
  } finally {
    release()
  }
}
