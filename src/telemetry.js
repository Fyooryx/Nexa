import { monitorEventLoopDelay } from 'node:perf_hooks'

const MB = 1024 * 1024

/**
 * Lightweight process telemetry.
 *
 * @typedef {Object} TelemetrySnapshot
 * @property {number} uptimeSeconds
 * @property {number} rssMb
 * @property {number} heapUsedMb
 * @property {number} heapTotalMb
 * @property {number} externalMb
 * @property {number} arrayBuffersMb
 * @property {number} eventLoopMeanMs
 * @property {number} eventLoopP95Ms
 * @property {number} eventLoopMaxMs
 */

export class RuntimeTelemetry {
  #histogram
  #resolution

  constructor({ resolutionMs = 20 } = {}) {
    this.#resolution = Math.max(1, Number(resolutionMs) || 20)
    this.#histogram = monitorEventLoopDelay({ resolution: this.#resolution })
  }

  start() {
    this.#histogram.enable()
    return this
  }

  stop() {
    this.#histogram.disable()
    return this
  }

  snapshot() {
    const memory = process.memoryUsage()
    const mean = Number(this.#histogram.mean)
    const p95 = Number(this.#histogram.percentile(95))
    const max = Number(this.#histogram.max)

    return {
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      rssMb: Number((memory.rss / MB).toFixed(2)),
      heapUsedMb: Number((memory.heapUsed / MB).toFixed(2)),
      heapTotalMb: Number((memory.heapTotal / MB).toFixed(2)),
      externalMb: Number((memory.external / MB).toFixed(2)),
      arrayBuffersMb: Number((memory.arrayBuffers / MB).toFixed(2)),
      eventLoopMeanMs: Number((mean / 1e6).toFixed(3)),
      eventLoopP95Ms: Number((p95 / 1e6).toFixed(3)),
      eventLoopMaxMs: Number((max / 1e6).toFixed(3))
    }
  }

  prometheus(snapshot, labels = {}) {
    const service = escapeLabel(labels.service || 'nexa')
    const connection = escapeLabel(labels.connection || 'unknown')
    const lines = [
      '# HELP nexa_up Process liveness indicator.',
      '# TYPE nexa_up gauge',
      'nexa_up 1',
      '# HELP nexa_uptime_seconds Process uptime in seconds.',
      '# TYPE nexa_uptime_seconds gauge',
      `nexa_uptime_seconds{${label('service', service)}} ${snapshot.uptimeSeconds}`,
      '# HELP nexa_process_resident_memory_bytes Resident set size in bytes.',
      '# TYPE nexa_process_resident_memory_bytes gauge',
      `nexa_process_resident_memory_bytes{${label('service', service)}} ${snapshot.rssMb * MB}`,
      '# HELP nexa_process_heap_used_bytes V8 heap used in bytes.',
      '# TYPE nexa_process_heap_used_bytes gauge',
      `nexa_process_heap_used_bytes{${label('service', service)}} ${snapshot.heapUsedMb * MB}`,
      '# HELP nexa_event_loop_lag_ms Event loop delay mean in milliseconds.',
      '# TYPE nexa_event_loop_lag_ms gauge',
      `nexa_event_loop_lag_ms{${label('service', service)}} ${snapshot.eventLoopMeanMs}`,
      '# HELP nexa_event_loop_p95_ms Event loop delay p95 in milliseconds.',
      '# TYPE nexa_event_loop_p95_ms gauge',
      `nexa_event_loop_p95_ms{${label('service', service)}} ${snapshot.eventLoopP95Ms}`,
      '# HELP nexa_event_loop_max_ms Maximum observed event loop delay in milliseconds.',
      '# TYPE nexa_event_loop_max_ms gauge',
      `nexa_event_loop_max_ms{${label('service', service)}} ${snapshot.eventLoopMaxMs}`,
      '# HELP nexa_ready WhatsApp readiness indicator.',
      '# TYPE nexa_ready gauge',
      `nexa_ready{${label('service', service)}} ${connection === 'open' ? 1 : 0}`
    ]

    return lines.join('\n') + '\n'
  }
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function label(key, value) {
  return `${key}="${value}"`
}
