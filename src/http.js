import http from 'node:http'

function writeJson(res, statusCode, payload, { head = false } = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  })
  if (!head) res.end(body)
  else res.end()
}

function writeText(res, statusCode, body, contentType = 'text/plain; version=0.0.4', { head = false } = {}) {
  res.writeHead(statusCode, {
    'content-type': contentType + '; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  })
  if (!head) res.end(body)
  else res.end()
}

export function createHealthServer({
  getSnapshot,
  getMetrics = null,
  metricsToken = '',
  host = '0.0.0.0',
  port = 3000,
  logger = console
} = {}) {
  if (typeof getSnapshot !== 'function') {
    throw new TypeError('getSnapshot must be a function')
  }
  if (getMetrics !== null && typeof getMetrics !== 'function') {
    throw new TypeError('getMetrics must be a function or null')
  }

  const server = http.createServer((req, res) => {
    const isHead = req.method === 'HEAD'
    const headOptions = { head: isHead }

    let pathname
    try {
      pathname = new URL(req.url || '/', 'http://localhost').pathname
    } catch (error) {
      logger.warn?.({ err: error }, 'invalid health request URL')
      return writeJson(res, 400, { error: 'bad_request' }, headOptions)
    }

    if (req.method !== 'GET' && !isHead) {
      res.setHeader('allow', 'GET, HEAD')
      return writeJson(res, 405, { error: 'method_not_allowed' })
    }

    if (pathname === '/healthz') {
      return writeJson(res, 200, {
        status: 'ok',
        service: 'nexa'
      }, headOptions)
    }

    if (pathname === '/readyz') {
      const snapshot = getSnapshot()
      const ready = snapshot?.connection === 'open'
      return writeJson(res, ready ? 200 : 503, {
        ready,
        connection: snapshot?.connection || 'unknown',
        uptime: snapshot?.uptime || 'unknown',
        version: snapshot?.version || 'unknown'
      }, headOptions)
    }

    if (pathname === '/metrics') {
      if (!getMetrics) return writeJson(res, 404, { error: 'metrics_not_enabled' }, headOptions)

      if (metricsToken) {
        const authorization = String(req.headers.authorization || '')
        const expected = 'Bearer ' + metricsToken
        if (authorization !== expected) {
          res.setHeader('www-authenticate', 'Bearer')
          return writeJson(res, 401, { error: 'unauthorized' }, headOptions)
        }
      }

      return writeText(res, 200, String(getMetrics()), 'text/plain; version=0.0.4', headOptions)
    }

    if (pathname === '/') {
      const snapshot = getSnapshot()
      return writeJson(res, 200, {
        service: 'nexa',
        version: snapshot?.version || 'unknown',
        connection: snapshot?.connection || 'unknown'
      }, headOptions)
    }

    return writeJson(res, 404, { error: 'not_found' }, headOptions)
  })

  server.on('error', error => {
    logger.error?.({ err: error }, 'Nexa health server error')
  })

  return {
    server,
    start() {
      return new Promise((resolve, reject) => {
        const onError = error => {
          server.off('listening', onListening)
          reject(error)
        }
        const onListening = () => {
          server.off('error', onError)
          resolve(server.address())
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, host)
      })
    },
    close() {
      return new Promise((resolve, reject) => {
        if (!server.listening) return resolve()
        server.close(error => error ? reject(error) : resolve())
      })
    }
  }
}
