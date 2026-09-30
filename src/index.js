import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import { config } from './config.js'
import { JsonStore } from './store.js'
import {
  getMessageText,
  isGroupJid,
  normalizeJid,
  numberFromJid,
  isOwner
} from './utils.js'
import {
  categories,
  findCommand,
  handleGroupAutomation
} from './commands.js'

const logger = pino({ level: config.logLevel })
const store = new JsonStore(config.dataDir)
await store.init()

let stopping = false

function senderOf(message) {
  return normalizeJid(message.key.participant || message.key.remoteJid || '')
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir)
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))
  let pairingRequested = false

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    browser: Browsers.macOS('Nexa'),
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => undefined
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update

    if (qr && !state.creds.registered && !config.pairingCode) {
      qrcode.generate(qr, { small: true })
    }

    if ((qr || connection === 'connecting') && !state.creds.registered && config.pairingCode && !pairingRequested) {
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
      logger.info({ jid: sock.user?.id }, 'Nexa connected')
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      logger.warn({ statusCode, shouldReconnect }, 'WhatsApp connection closed')

      if (shouldReconnect && !stopping) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        await start()
      }
    }
  })

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    const settings = store.group(id)
    if ((action === 'add' && settings.welcome) || (action === 'remove' && settings.goodbye)) {
      for (const participant of participants) {
        const mention = `@${numberFromJid(participant)}`
        const text = action === 'add'
          ? `👋 Selamat datang ${mention} di grup!`
          : `👋 ${mention} keluar dari grup.`
        await sock.sendMessage(id, { text, mentions: [participant] }).catch(() => {})
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const message of messages) {
      try {
        if (!message.message || message.key.fromMe) continue
        await handleIncoming(sock, message)
      } catch (error) {
        logger.error({ err: error }, 'message handler failed')
        const jid = message.key.remoteJid
        if (jid) {
          await sock.sendMessage(jid, {
            text: 'Nexa mengalami error saat memproses pesan.'
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

  const ctxBase = {
    sock,
    message,
    jid,
    sender,
    text,
    store,
    config,
    logger,
    prefix: config.prefix,
    isOwner: isOwner(sender, config.ownerNumber),
    reply: (content, extra = {}) => sock.sendMessage(
      jid,
      { text: content, ...extra },
      { quoted: message }
    )
  }

  const state = store.user(sender)

  if (state.afk && !text.startsWith(config.prefix)) {
    state.afk = null
    await store.persist()
    await ctxBase.reply('AFK dinonaktifkan karena kamu aktif kembali.')
  }

  if (isGroupJid(jid)) {
    const mentioned = Object.entries(store.data.users).find(([userJid, data]) => (
      data.afk && text.includes(numberFromJid(userJid))
    ))
    if (mentioned) {
      await sock.sendMessage(jid, {
        text: `💤 @${numberFromJid(mentioned[0])} sedang AFK: ${mentioned[1].afk.reason}`,
        mentions: [mentioned[0]]
      })
    }

    const automated = await handleGroupAutomation(ctxBase)
    if (automated) return
  }

  if (!text.startsWith(config.prefix)) return

  const body = text.slice(config.prefix.length).trim()
  const [name, ...args] = body.split(/\s+/)
  if (!name) return

  if (name.toLowerCase() === 'menu') {
    const lines = [`*${config.botName}*`, 'All-in-one WhatsApp bot', '']
    for (const [category, list] of categories()) {
      lines.push(`*${category}*`)
      for (const item of list) lines.push(`• ${config.prefix}${item.name} — ${item.description}`)
      lines.push('')
    }
    lines.push(`Prefix: ${config.prefix}`)
    return ctxBase.reply(lines.join('\n'))
  }

  const cmd = findCommand(name)
  if (!cmd) return

  const ctx = {
    ...ctxBase,
    args
  }

  try {
    await cmd.run(ctx)
  } catch (error) {
    const messages = {
      GROUP_ONLY: 'Perintah ini hanya bisa dipakai di grup.',
      ADMIN_ONLY: 'Perintah ini membutuhkan status admin grup.',
      BOT_ADMIN_ONLY: 'Nexa harus menjadi admin grup terlebih dahulu.',
      OWNER_ONLY: 'Perintah ini khusus owner.'
    }

    if (messages[error.message]) {
      return ctx.reply(`⚠️ ${messages[error.message]}`)
    }

    throw error
  }
}

process.on('SIGINT', () => {
  stopping = true
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopping = true
  process.exit(0)
})

await start()
