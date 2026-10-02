import { createHealthServer } from './http.js'
import { config } from './config.js'
import { runtime } from './runtime.js'

await import('./index.js')

const healthServer = createHealthServer({
  host: config.healthHost,
  port: config.healthPort,
  logger: console,
  getSnapshot: () => ({
    connection: runtime.connection,
    uptime: String(Math.floor(process.uptime())) + 's',
    version: config.botVersion
  })
})

const address = await healthServer.start()
console.log('Nexa health server listening', address)
