import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import { config } from './config.js'
import { JsonStore } from './store.js'
import {
  extractMentions,
  getMessageText,
  isGroupJid,
  isOwner,
  normalizeJid,
  numberFromJid,
  parseCommand
} from './utils.js'
import { categories, findCommand, handleGroupAutomation } from './commands.js'
import { RateLimiter, MessageDeduper } from './limits.js'

const logger = pino({ level: config.logLevel })
const store = new JsonStore(config.dataDir)
await store.init()

const commandLimiter = new RateLimiter({
  intervalMs: config.commandCooldownMs * config.maxCommandsPerWindow,
  max: config.maxCommandsPerWindow
})
const seenMessages = new MessageDeduper()
const lastCommand = new Map()

let stopping = false
let reconnectTimer = null
let reconnectAttempt = 0

function senderOf(message) {
  return normalizeJid(message.key.participant || message.key.remoteJid || '')
}

function currentPrefix(jid) {
  return isGroupJid(jid) ? store.groupPrefix(jid, config.prefix) : config.prefix
}

function scheduleReconnect() {
  if (stopping || reconnectTimer) return

  reconnectAttempt += 1
  const delay = Math.min(30000, 1500 * (2 ** Math.min(reconnectAttempt - 1, 5)))
  logger.warn({ delay, attempt: reconnectAttempt }, 'scheduling reconnect')

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try {
      await start()
    } catch (error) {
      logger.error({ err: error }, 'reconnect attempt failed')
      scheduleReconnect()
    }
  }, delay)
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir)
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))
  let pairingRequested = false

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    // Chrome tuple avoids a known 428 connection loop seen with Desktop on Baileys 7 RC.
    browser: Browsers.macOS('Chrome'),
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    getMessage: async () => undefined
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update

    if (qr && !state.creds.registered && !config.pairingCode) {
      qrcode.generate(qr, { small: true })
    }

    if (
      connection === 'connecting'
      && !state.creds.registered
      && config.pairingCode
      && !pairingRequested
    ) {
      pairingRequested = true
      try {
        const code = await sock.requestPairingCode(config.pairingCode)
        console.log(`Nexa pairing code: ${code}`)
      } catch (error) {
        pairingRequested = false
        logger.error({ err: error }, 'pairing code request failed')
      }
    }

    if (connection === 'open') {
      reconnectAttempt = 0
      logger.info({ jid: sock.user?.id, name: config.botName }, 'Nexa connected')
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      logger.warn({ statusCode, shouldReconnect }, 'WhatsApp connection closed')
      if (shouldReconnect) scheduleReconnect()
      else logger.error('Session logged out; delete auth_info and link Nexa again when needed.')
    }
  })

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    const group = store.group(id)

    if (action === 'add' && group.welcome) {
      for (const participant of participants) {
        const mention = `@${numberFromJid(participant)}`
        const text = group.welcomeText.replaceAll('@user', mention)
        await sock.sendMessage(id, {
          text,
          mentions: [participant]
        }).catch(() => {})
      }
    }

    if ((action === 'remove' || action === 'leave') && group.goodbye) {
      for (const participant of participants) {
        const mention = `@${numberFromJid(participant)}`
        const text = group.goodbyeText.replaceAll('@user', mention)
        await sock.sendMessage(id, {
          text,
          mentions: [participant]
        }).catch(() => {})
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const message of messages) {
      if (!message?.message || message.key.fromMe) continue
      if (seenMessages.seen(message.key.id)) continue

      try {
        await handleIncoming(sock, message)
      } catch (error) {
        logger.error({
          err: error,
          jid: message.key.remoteJid,
          messageId: message.key.id
        }, 'message handler failed')

        const jid = message.key.remoteJid
        if (jid) {
          await sock.sendMessage(jid, {
            text: '⚠️ Nexa gagal memproses pesan tersebut.'
          }).catch(() => {})
        }
      }
    }
  })

  return sock
}

async function handleIncoming(sock, message) {
  const jid = message.key.remoteJid
  if (!jid || jid === 'status@broadcast') return

  const sender = senderOf(message)
  const text = getMessageText(message).trim()
  if (!text) return
  if (text.length > config.maxMessageLength) return

  store.bumpMessage(false)

  const prefix = currentPrefix(jid)
  const parsed = parseCommand(text, prefix)
  const isCommand = Boolean(parsed)
  if (isCommand) store.bumpMessage(true)

  const ctxBase = {
    sock,
    message,
    jid,
    sender,
    text,
    store,
    config,
    logger,
    prefix,
    isOwner: isOwner(sender, config.ownerNumber),
    reply: (content, extra = {}) => sock.sendMessage(
      jid,
      { text: content, ...extra },
      { quoted: message }
    )
  }

  const user = store.user(sender)
  if (user.afk) {
    user.afk = null
    await store.persist()
    if (!isCommand) await ctxBase.reply('💤 AFK dinonaktifkan karena kamu aktif kembali.')
  }

  if (isGroupJid(jid)) {
    const mentioned = extractMentions(message.message, text)
      .map(normalizeJid)
      .find(target => store.user(target).afk)

    if (mentioned) {
      const afk = store.user(mentioned).afk
      await sock.sendMessage(jid, {
        text: `💤 @${numberFromJid(mentioned)} sedang AFK: ${afk.reason}`,
        mentions: [mentioned]
      })
    }

    if (await handleGroupAutomation(ctxBase)) return
  }

  if (!parsed) return

  const { name, args } = parsed
  const cmd = findCommand(name)
  if (!cmd) return

  const openCommands = new Set(['menu', 'help', 'enable', 'disable', 'disabled'])
  if (
    isGroupJid(jid)
    && store.isCommandDisabled(jid, cmd.name)
    && !openCommands.has(cmd.name)
    && !isOwner(sender, config.ownerNumber)
  ) {
    return
  }

  const now = Date.now()
  const last = lastCommand.get(sender) || 0
  if (now - last < config.commandCooldownMs && !isOwner(sender, config.ownerNumber)) {
    return
  }
  if (!commandLimiter.allow(sender) && !isOwner(sender, config.ownerNumber)) {
    return ctxBase.reply('⏳ Terlalu banyak command. Coba lagi sebentar.')
  }
  lastCommand.set(sender, now)

  const ctx = { ...ctxBase, args }

  try {
    await cmd.run(ctx)
    await store.persist()
  } catch (error) {
    const messages = {
      GROUP_ONLY: 'Perintah ini hanya bisa dipakai di grup.',
      ADMIN_ONLY: 'Perintah ini membutuhkan status admin grup.',
      BOT_ADMIN_ONLY: 'Nexa harus menjadi admin grup terlebih dahulu.',
      OWNER_ONLY: 'Perintah ini khusus owner.'
    }
    if (messages[error.message]) return ctx.reply(`⚠️ ${messages[error.message]}`)
    throw error
  }
}

setInterval(() => {
  commandLimiter.prune()
}, Math.max(config.commandCooldownMs * 10, 10000)).unref()

process.on('SIGINT', () => {
  stopping = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopping = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  process.exit(0)
})

try {
  await start()
} catch (error) {
  logger.error({ err: error }, 'initial Nexa connection failed')
  scheduleReconnect()
}
