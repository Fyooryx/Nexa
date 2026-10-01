export const runtime = {
  connection: 'idle',
  connectedAt: null,
  lastDisconnectedAt: null,
  lastDisconnectCode: null,
  reconnects: 0,
  startedAt: Date.now()
}

export function markConnecting() {
  runtime.connection = 'connecting'
}

export function markOpen() {
  runtime.connection = 'open'
  runtime.connectedAt = Date.now()
}

export function markClosed(statusCode = null) {
  runtime.connection = 'closed'
  runtime.lastDisconnectedAt = Date.now()
  runtime.lastDisconnectCode = statusCode
  runtime.reconnects += 1
}
