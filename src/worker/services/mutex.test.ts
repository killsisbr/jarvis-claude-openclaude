import { describe, it, expect, vi } from 'vitest'
import { Mutex, withLock, withLockTimeout, acquireWithTimeout } from './mutex'

describe('Mutex', () => {
  describe('acquire and release', () => {
    it('should acquire lock synchronously if available', async () => {
      const mutex = new Mutex()
      const release = await mutex.acquire()

      expect(mutex.isLocked()).toBe(true)
      release()
      expect(mutex.isLocked()).toBe(false)
    })

    it('should queue subsequent acquisitions', async () => {
      const mutex = new Mutex()
      const release1 = await mutex.acquire()

      // This should queue
      const promise2 = mutex.acquire()
      expect(mutex.getQueueSize()).toBe(1)

      // Release first lock
      release1()

      // Second acquisition should complete
      const release2 = await promise2
      expect(mutex.getQueueSize()).toBe(0)
      release2()
    })

    it('should process queue in FIFO order', async () => {
      const mutex = new Mutex()
      const order: number[] = []

      const release1 = await mutex.acquire()
      order.push(1)

      // Queue up multiple acquisitions
      mutex.acquire().then((release) => {
        order.push(2)
        release()
      })

      mutex.acquire().then((release) => {
        order.push(3)
        release()
      })

      // Give async operations time to queue
      await new Promise((resolve) => setTimeout(resolve, 10))

      release1()

      // Wait for queue to process
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(order).toEqual([1, 2, 3])
    })
  })

  describe('withLock', () => {
    it('should execute function with lock held', async () => {
      const mutex = new Mutex()
      let executed = false

      await withLock(mutex, async () => {
        executed = true
        expect(mutex.isLocked()).toBe(true)
      })

      expect(executed).toBe(true)
      expect(mutex.isLocked()).toBe(false)
    })

    it('should release lock even if function throws', async () => {
      const mutex = new Mutex()

      try {
        await withLock(mutex, async () => {
          throw new Error('Test error')
        })
      } catch (e) {
        // Expected
      }

      expect(mutex.isLocked()).toBe(false)
    })

    it('should return function result', async () => {
      const mutex = new Mutex()

      const result = await withLock(mutex, async () => {
        return 'test result'
      })

      expect(result).toBe('test result')
    })

    it('should serialize function calls', async () => {
      const mutex = new Mutex()
      const order: number[] = []

      const p1 = withLock(mutex, async () => {
        order.push(1)
        await new Promise((resolve) => setTimeout(resolve, 10))
        order.push(1)
      })

      // Add small delay to ensure first lock is acquired
      await new Promise((resolve) => setTimeout(resolve, 5))

      const p2 = withLock(mutex, async () => {
        order.push(2)
        await new Promise((resolve) => setTimeout(resolve, 10))
        order.push(2)
      })

      await Promise.all([p1, p2])

      // p1 should complete before p2 starts
      expect(order).toEqual([1, 1, 2, 2])
    })
  })

  describe('withLockTimeout', () => {
    it('should execute function with timeout', async () => {
      const mutex = new Mutex()
      let executed = false

      await withLockTimeout(
        mutex,
        async () => {
          executed = true
        },
        1000
      )

      expect(executed).toBe(true)
    })

    it('should throw on timeout', async () => {
      const mutex = new Mutex()
      const release = await mutex.acquire()

      let timedOut = false
      try {
        await withLockTimeout(
          mutex,
          async () => {
            // Will never execute
          },
          100
        )
      } catch (error) {
        timedOut = error instanceof Error && error.message.includes('timeout')
      }

      release()
      expect(timedOut).toBe(true)
    })

    it('should handle timeout gracefully', async () => {
      const mutex = new Mutex()
      const release1 = await mutex.acquire()

      let timedOut = false
      try {
        // This will queue and then timeout waiting for lock
        await withLockTimeout(mutex, async () => {}, 50)
      } catch {
        timedOut = true
      }

      expect(timedOut).toBe(true)
      // First lock still held
      expect(mutex.isLocked()).toBe(true)
      release1()
    })
  })

  describe('acquireWithTimeout', () => {
    it('should acquire lock with timeout', async () => {
      const mutex = new Mutex()
      const release = await acquireWithTimeout(mutex, 1000)

      expect(release).not.toBeNull()
      release?.()
    })

    it('should return null on timeout', async () => {
      const mutex = new Mutex()
      const release1 = await mutex.acquire()

      const release2 = await acquireWithTimeout(mutex, 100)

      expect(release2).toBeNull()
      release1()
    })
  })

  describe('concurrent access', () => {
    it('should handle many concurrent acquisitions', async () => {
      const mutex = new Mutex()
      let counter = 0

      const promises = Array.from({ length: 10 }).map(() =>
        withLock(mutex, async () => {
          counter++
          await new Promise((resolve) => setTimeout(resolve, 5))
        })
      )

      await Promise.all(promises)

      expect(counter).toBe(10)
      expect(mutex.isLocked()).toBe(false)
    })

    it('should prevent race conditions', async () => {
      const mutex = new Mutex()
      let sharedValue = 0

      const increment = async () => {
        await withLock(mutex, async () => {
          const temp = sharedValue
          await new Promise((resolve) => setTimeout(resolve, 1))
          sharedValue = temp + 1
        })
      }

      await Promise.all([increment(), increment(), increment(), increment()])

      // Without mutex, this would be < 4 due to race conditions
      expect(sharedValue).toBe(4)
    })
  })
})
