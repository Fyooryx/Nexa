import 'dotenv/config'

const digits = value => value.replace(/\D/g, '')

export const config = Object.freeze({
  botName: process.env.BOT_NAME || 'Nexa',
  prefix: process.env.PREFIX || '.',
  ownerNumber: digits(process.env.OWNER_NUMBER || ''),
  authDir: process.env.AUTH_DIR || 'auth_info',
  dataDir: process.env.DATA_DIR || 'data',
  logLevel: process.env.LOG_LEVEL || 'info',
  pairingCode: digits(process.env.PAIRING_CODE || ''),
  ai: {
    key: process.env.AI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini'
  }
})
