export class RateLimiter {
  constructor({ intervalMs = 3000, max = 3 } = {}) {
    this.intervalMs = intervalMs
    this.max = max
    this.buckets = new Map()
  }

  allow(key) {
    const now = Date.now()
    const bucket = this.buckets.get(key) || []
    const fresh = bucket.filter(ts => now - ts < this.intervalMs)
    if (fresh.length >= this.max) {
      this.buckets.set(key, fresh)
      return false
    }
    fresh.push(now)
    this.buckets.set(key, fresh)
    return true
  }

  prune(maxKeys = 5000) {
    const now = Date.now()
    for (const [key, bucket] of this.buckets) {
      const fresh = bucket.filter(ts => now - ts < this.intervalMs)
      if (fresh.length) this.buckets.set(key, fresh)
      else this.buckets.delete(key)
    }
    if (this.buckets.size <= maxKeys) return

    const excess = this.buckets.size - maxKeys
    let removed = 0
    for (const key of this.buckets.keys()) {
      this.buckets.delete(key)
      if (++removed >= excess) break
    }
  }
}

export class MessageDeduper {
  constructor(limit = 5000) {
    this.limit = limit
    this.items = new Map()
  }

  seen(id) {
    if (!id) return false
    if (this.items.has(id)) return true
    this.items.set(id, Date.now())
    if (this.items.size > this.limit) {
      const first = this.items.keys().next().value
      if (first) this.items.delete(first)
    }
    return false
  }
}
