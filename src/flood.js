export class FloodGuard {
  constructor({ maxKeys = 10000 } = {}) {
    this.maxKeys = maxKeys
    this.buckets = new Map()
  }

  hit(key, { windowMs = 5000, max = 6 } = {}) {
    const safeWindowMs = Math.max(1000, Number(windowMs) || 5000)
    const safeMax = Math.max(2, Number(max) || 6)
    const now = Date.now()
    const bucket = this.buckets.get(key) || []
    const fresh = bucket.filter(ts => now - ts < safeWindowMs)
    const limited = fresh.length >= safeMax
    const firstViolation = limited && fresh.length === safeMax
    fresh.push(now)
    this.buckets.set(key, fresh)
    return { limited, firstViolation, count: fresh.length }
  }

  prune(maxAgeMs = 60000) {
    const now = Date.now()
    for (const [key, bucket] of this.buckets) {
      const fresh = bucket.filter(ts => now - ts < maxAgeMs)
      if (fresh.length) this.buckets.set(key, fresh)
      else this.buckets.delete(key)
    }

    if (this.buckets.size <= this.maxKeys) return
    const excess = this.buckets.size - this.maxKeys
    let removed = 0
    for (const key of this.buckets.keys()) {
      this.buckets.delete(key)
      if (++removed >= excess) break
    }
  }
}
