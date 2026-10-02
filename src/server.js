import { createHealthServer } from './http.js'
import { config } from './config.js'
import { runtime } from './runtime.js'
import { RuntimeTelemetry } from './telemetry.js'

const telemetry = new RuntimeTelemetry().start()

const healthServer = createHealthServer({
  host: config.healthHost,
  port: config.healthPort,
  logger: console,
  metricsToken: config.metricsToken,
  getSnapshot: () => ({
    connection: runtime.connection,
    uptime: String(Math.floor(process.uptime())) + 's',
    version: config.botVersion
  }),
  getMetrics: () => telemetry.prometheus(
    telemetry.snapshot(),
    { service: config.botName, connection: runtime.connection }
  )
})

const address = await healthServer.start()
console.log('Nexa health server listening', address)

await import('./index.js')
