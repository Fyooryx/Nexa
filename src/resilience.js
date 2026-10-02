export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

export class CircuitBreaker {
  constructor({
    failureThreshold = 3,
    resetTimeoutMs = 30000,
    now = () => Date.now()
  } = {}) {
    this.failureThreshold = Math.max(1, Number(failureThreshold) || 3)
    this.resetTimeoutMs = Math.max(1000, Number(resetTimeoutMs) || 30000)
    this.now = now
    this.state = 'closed'
    this.failures = 0
    this.openedAt = 0
    this.halfOpenProbe = false
  }

  get status() {
    return {
      state: this.state,
      failures: this.failures,
      openedAt: this.openedAt
    }
  }

  canAttempt() {
    if (this.state === 'closed') return true
    if (this.state === 'open' && this.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = 'half-open'
      this.halfOpenProbe = false
      return true
    }
    return false
  }

  async execute(task) {
    if (typeof task !== 'function') throw new TypeError('task must be a function')

    if (!this.canAttempt()) {
      throw new CircuitOpenError()
    }

    if (this.state === 'half-open') {
      if (this.halfOpenProbe) throw new CircuitOpenError('Circuit breaker probe already in flight')
      this.halfOpenProbe = true
    }

    try {
      const result = await task()
      this.#onSuccess()
      return result
    } catch (error) {
      this.#onFailure()
      throw error
    }
  }

  #onSuccess() {
    this.failures = 0
    this.openedAt = 0
    this.state = 'closed'
    this.halfOpenProbe = false
  }

  #onFailure() {
    this.halfOpenProbe = false
    this.failures += 1
    if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
      this.state = 'open'
      this.openedAt = this.now()
    }
  }
}

export async function fetchWithRetry(
  url,
  options = {},
  {
    retries = 2,
    baseDelayMs = 250,
    maxDelayMs = 5000,
    shouldRetry = defaultShouldRetry,
    sleep = delay => new Promise(resolve => setTimeout(resolve, delay))
  } = {}
) {
  const attempts = Math.max(0, Number(retries) || 0)
  const base = Math.max(0, Number(baseDelayMs) || 0)
  const max = Math.max(base, Number(maxDelayMs) || 5000)

  let attempt = 0
  while (true) {
    try {
      const response = await fetch(url, options)
      if (!shouldRetry(response) || attempt >= attempts) return response

      const retryAfter = parseRetryAfter(response.headers?.get?.('retry-after'))
      const exponential = Math.min(max, base * (2 ** attempt))
      await sleep(Math.max(retryAfter ?? 0, exponential))
    } catch (error) {
      if (options.signal?.aborted) throw error
      if (attempt >= attempts) throw error
      const delay = Math.min(max, base * (2 ** attempt))
      await sleep(delay)
    }
    attempt += 1
  }
}

function defaultShouldRetry(response) {
  return response?.status === 429 || response?.status >= 500
}

function parseRetryAfter(value) {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, timestamp - Date.now())
}
