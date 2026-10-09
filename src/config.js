import 'dotenv/config'

const digits = value => value.replace(/\D/g, '')
const int = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export const config = Object.freeze({
  botName: process.env.BOT_NAME || 'Nexa',
  botVersion: '3.10.0',
  ownerName: process.env.OWNER_NAME || 'Vyrael',
  prefix: process.env.PREFIX || '.',
  ownerNumber: digits(process.env.OWNER_NUMBER || ''),
  ownerEmail: process.env.OWNER_EMAIL || 'zavriel.studio@gmail.com',
  ownerTikTok: (process.env.OWNER_TIKTOK || 'zavriel.id').replace(/^@/, ''),
  authDir: process.env.AUTH_DIR || 'auth_info',
  dataDir: process.env.DATA_DIR || 'data',
  logLevel: process.env.LOG_LEVEL || 'info',
  pairingNumber: digits(process.env.PAIRING_NUMBER || process.env.PAIRING_CODE || ''),
  healthHost: process.env.HEALTH_HOST || '0.0.0.0',
  healthPort: int(process.env.PORT || process.env.HEALTH_PORT, 3000, 0, 65535),
  metricsToken: process.env.METRICS_TOKEN || '',
  maxMessageLength: int(process.env.MAX_MESSAGE_LENGTH, 8000, 500, 20000),
  maxMediaBytes: int(process.env.MAX_MEDIA_BYTES, 8 * 1024 * 1024, 64 * 1024, 50 * 1024 * 1024),
  maxStoredUsers: int(process.env.MAX_STORED_USERS, 50000, 1000, 200000),
  maxStoredGroups: int(process.env.MAX_STORED_GROUPS, 10000, 100, 50000),
  storeFlushMs: int(process.env.STORE_FLUSH_MS, 15000, 5000, 120000),
  commandCooldownMs: int(process.env.COMMAND_COOLDOWN_MS, 2500, 500, 60000),
  maxCommandsPerWindow: int(process.env.MAX_COMMANDS_PER_WINDOW, 3, 1, 20),
  warnLimit: int(process.env.WARN_LIMIT, 3, 1, 10),
  ai: {
    key: process.env.AI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    maxTurns: int(process.env.AI_MAX_TURNS, 6, 2, 12),
    timeoutMs: int(process.env.AI_TIMEOUT_MS, 30000, 5000, 120000),
    maxRetries: int(process.env.AI_MAX_RETRIES, 2, 0, 5),
    retryBaseMs: int(process.env.AI_RETRY_BASE_MS, 250, 50, 5000),
    circuitFailureThreshold: int(process.env.AI_CIRCUIT_FAILURE_THRESHOLD, 3, 1, 10),
    circuitResetMs: int(process.env.AI_CIRCUIT_RESET_MS, 30000, 1000, 300000)
  }
})
