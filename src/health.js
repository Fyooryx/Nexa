import { formatDuration } from './utils.js'
import { runtime } from './runtime.js'

function mb(value) {
  return Math.round(value / 1024 / 1024)
}

export function healthSnapshot({ sock, store, config, runtimeState = runtime }) {
  const memory = process.memoryUsage()

  return {
    bot: config.botName,
    version: config.botVersion,
    owner: config.ownerName,
    connected: runtimeState.connection === 'open',
    connection: runtimeState.connection,
    connectedAt: runtimeState.connectedAt,
    lastDisconnectedAt: runtimeState.lastDisconnectedAt,
    lastDisconnectCode: runtimeState.lastDisconnectCode,
    reconnects: runtimeState.reconnects,
    uptime: formatDuration(process.uptime()),
    node: process.version,
    memory: {
      rssMb: mb(memory.rss),
      heapUsedMb: mb(memory.heapUsed),
      heapTotalMb: mb(memory.heapTotal)
    },
    counters: {
      messages: Number(store.data.meta.messages || 0),
      commands: Number(store.data.meta.commands || 0),
      groups: Object.keys(store.data.groups || {}).length,
      users: Object.keys(store.data.users || {}).length
    }
  }
}

export function formatHealth(snapshot) {
  return [
    `*${snapshot.bot} health*`,
    `Version: ${snapshot.version}`,
    `Owner: ${snapshot.owner}`,
`Connection: ${snapshot.connection.toUpperCase()}`,
    `Uptime: ${snapshot.uptime}`,
    `Node: ${snapshot.node}`,
    `Memory: ${snapshot.memory.rssMb} MB RSS | ${snapshot.memory.heapUsedMb}/${snapshot.memory.heapTotalMb} MB heap`,
    `Messages: ${snapshot.counters.messages}`,
    `Commands: ${snapshot.counters.commands}`,
    `Groups: ${snapshot.counters.groups}`,
    `Users: ${snapshot.counters.users}`
  ].join('\\n')
}
