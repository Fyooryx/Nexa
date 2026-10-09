import crypto from 'node:crypto'
import sharp from 'sharp'
import { config } from './config.js'
import { CommandRegistry } from './registry.js'
import { CircuitBreaker, CircuitOpenError, fetchWithRetry } from './resilience.js'
import { formatHealth, healthSnapshot } from './health.js'
import { addKeyword, findMatchedKeyword, listKeywords, removeKeyword } from './filters.js'
import { adminParticipants, adminSet, isAdmin, isBotAdmin, participantJids } from './metadata.js'
import {
  downloadNode,
  extractMentions,
  formatDuration,
  getMediaNode,
  getQuotedMessage,
  isGroupJid,
  isLikelyUrl,
  normalizeJid,
  numberFromJid,
  targetFromContext,
  truncate
} from './utils.js'

function safeIdentity(jid) {
  const value = normalizeJid(jid || '')
  if (!value) return 'not connected'
  if (value.endsWith('@s.whatsapp.net')) {
    const number = numberFromJid(value)
    return number.length > 6 ? `${number.slice(0, 4)}…${number.slice(-2)}` : 'phone identity'
  }
  if (value.endsWith('@lid')) return 'LID identity'
  return 'non-phone identity'
}

function command(name, aliases, category, description, run, options = {}) {
  return { name, aliases, category, description, run, ...options }
}

async function requireGroup(ctx) {
  if (!isGroupJid(ctx.jid)) throw new Error('GROUP_ONLY')
  return ctx.sock.groupMetadata(ctx.jid)
}

async function requireAdmin(ctx, meta = null) {
  const metadata = meta || await requireGroup(ctx)
  if (!isAdmin(metadata, ctx.sender, ctx.sock) && !(ctx.senderAlt && isAdmin(metadata, ctx.senderAlt, ctx.sock))) {
    throw new Error('ADMIN_ONLY')
  }
  return metadata
}

async function requireBotAdmin(ctx, meta = null) {
  const metadata = meta || await requireGroup(ctx)
  if (!isBotAdmin(ctx.sock, metadata)) throw new Error('BOT_ADMIN_ONLY')
  return metadata
}

async function requireOwner(ctx) {
  if (!ctx.isOwner) throw new Error('OWNER_ONLY')
}

function settings(ctx) {
  return ctx.store.group(ctx.jid)
}

async function resolveTarget(ctx, meta) {
  const raw = targetFromContext(ctx.message.message, ctx.text)
  if (!raw) return null
  const target = normalizeJid(raw)
  const participant = (meta?.participants || []).find(item => participantJids(item).includes(target))
  return participant?.id || participant?.phoneNumber || participant?.lid || target
}

async function findMedia(ctx, type) {
  const direct = getMediaNode(ctx.message.message)
  if (direct?.type === type) return direct.node
  const quoted = getQuotedMessage(ctx.message.message)
  const quotedMedia = quoted ? getMediaNode(quoted.message) : null
  return quotedMedia?.type === type ? quotedMedia.node : null
}

function formatList(title, items) {
  return [`*${title}*`, ...items.map(item => `• ${item}`)].join('\n')
}

const aiCircuit = new CircuitBreaker({
  failureThreshold: config.ai.circuitFailureThreshold,
  resetTimeoutMs: config.ai.circuitResetMs
})

export const COMMANDS = [
  command('diagnose', ['diag'], 'General', 'Ringkasan diagnostik aman untuk setup dan troubleshooting.', async ctx => {
    const snapshot = healthSnapshot(ctx)
    const pairing = ctx.config.pairingNumber ? 'configured' : 'empty (QR mode)'
    return ctx.reply([
      `*Nexa diagnose*`,
      `Version: ${snapshot.version}`,
      `Connection: ${snapshot.connection}`,
      `Auth: ${snapshot.authMode}`,
      `Bot identity: ${snapshot.connected ? safeIdentity(ctx.sock.user?.id) : 'not connected'}`,
      `Pairing number: ${pairing}`,
      `Groups: ${snapshot.counters.groups}`,
      `Users: ${snapshot.counters.users}`,
      `Messages: ${snapshot.counters.messages}`,
      `Commands: ${snapshot.counters.commands}`,
      `Reconnects: ${snapshot.reconnects}`,
      `Memory RSS: ${snapshot.memory.rssMb} MB`,
      `Metadata cache: ${snapshot.metadataCacheSize}`
    ].join('\\n'))
  }),

  command('authstatus', ['auth'], 'General', 'Tampilkan mode autentikasi Nexa saat ini.', async ctx => {
    const modeLabel = {
      'pairing-code': 'PAIRING CODE',
      qr: 'QR',
      'saved-session': 'SAVED SESSION'
    }[ctx.authMode] || 'UNKNOWN'
    const identity = ctx.sock.user?.id || ''
    return ctx.reply(
      [
        `🔐 Auth: ${modeLabel}`,
        `Connected: ${ctx.sock.user ? 'yes' : 'no'}`,
        `Bot identity: ${safeIdentity(identity)}`
      ].join('\\n')
    )
  }),

  command('botid', ['botnumber'], 'General', 'Tampilkan identitas akun WhatsApp Nexa yang sedang terhubung.', async ctx => {
    const id = ctx.sock.user?.id || ''
    const lid = ctx.sock.user?.lid || ''
    if (ctx.args[0]?.toLowerCase() === 'full') {
      await requireOwner(ctx)
      return ctx.reply(`🤖 Bot JID: ${id || '-'}
LID: ${lid || '-'}`)
    }
    return ctx.reply(`🤖 Bot identity: ${safeIdentity(id)}
LID: ${safeIdentity(lid)}`)
  }),

  command('menu', ['start'], 'General', 'Tampilkan semua fitur.', async ctx => {
    const groups = new Map()
    for (const item of COMMANDS) {
      if (!groups.has(item.category)) groups.set(item.category, [])
      groups.get(item.category).push(item)
    }

    const lines = [`*${config.botName}*`, 'All-in-one WhatsApp bot', '']
    for (const [category, list] of groups) {
      lines.push(`*${category}*`)
      for (const item of list) lines.push(`• ${ctx.prefix}${item.name} — ${item.description}`)
      lines.push('')
    }
    lines.push(`Prefix chat: ${ctx.prefix}`)
    lines.push(`Detail command: ${ctx.prefix}help <command>`)
    return ctx.reply(truncate(lines.join('\n'), 11000))
  }),

  command('help', [], 'General', 'Detail penggunaan satu command.', async ctx => {
    const name = ctx.args[0]?.toLowerCase()
    if (!name) return ctx.reply(`Gunakan ${ctx.prefix}help <command>`)
    const cmd = findCommand(name)
    if (!cmd) return ctx.reply('Command tidak ditemukan.')

    const aliases = cmd.aliases.length ? cmd.aliases.map(a => `${ctx.prefix}${a}`).join(', ') : '-'
    const usage = cmd.usage ? `\nUsage: ${ctx.prefix}${cmd.usage}` : ''
    return ctx.reply(`*${ctx.prefix}${cmd.name}*\nKategori: ${cmd.category}\n${cmd.description}\nAlias: ${aliases}${usage}`)
  }, { usage: 'help <command>' }),

  command('ping', ['p'], 'General', 'Cek koneksi dan latency.', async ctx => {
    const started = Date.now()
    const sent = await ctx.reply('🏓 Testing…')
    const elapsed = Date.now() - started
    if (sent?.key) {
      await ctx.sock.sendMessage(ctx.jid, {
        text: `Pong: ${elapsed} ms | Server: ${Date.now() - started} ms`
      })
    }
  }),

  command('runtime', ['uptime'], 'General', 'Lihat uptime Node.js.', async ctx => {
    return ctx.reply(`⏱️ Uptime: ${formatDuration(process.uptime())}\nNode: ${process.version}`)
  }),

  command('about', ['botinfo'], 'General', 'Info build Nexa.', async ctx => {
    return ctx.reply(
      `*${config.botName} v${config.botVersion}*\nModular AIO WhatsApp bot\nOwner: ${config.ownerName}\nEngine: Baileys\nNode: ${process.version}\nPrefix: ${ctx.prefix}`
    )
  }),

  command('health', [], 'General', 'Tampilkan ringkasan kesehatan runtime.', async ctx => {
    return ctx.reply(formatHealth(healthSnapshot(ctx)))
  }),

  command('owner', ['creator'], 'General', 'Tampilkan identitas owner Nexa.', async ctx => {
    if (ctx.isOwner && config.ownerNumber) {
      return ctx.reply(`👑 Owner: ${config.ownerName}
https://wa.me/${config.ownerNumber}`)
    }
    return ctx.reply(`👑 Owner: ${config.ownerName}`)
  }),

  command('id', ['jid'], 'General', 'Tampilkan identitas chat dan sender.', async ctx => {
    if (ctx.args[0]?.toLowerCase() === 'full') {
      await requireOwner(ctx)
      return ctx.reply(`Chat: ${ctx.jid}
Sender: ${ctx.sender}
Number: ${numberFromJid(ctx.sender)}`)
    }
    const chatType = isGroupJid(ctx.jid) ? 'group' : 'private'
    return ctx.reply(`Chat type: ${chatType}
Sender: ${safeIdentity(ctx.sender)}`)
  }),

  command('time', [], 'General', 'Tampilkan waktu timezone tertentu.', async ctx => {
    const zone = ctx.args[0] || 'Asia/Jakarta'
    try {
      const now = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: zone
      }).format(new Date())
      return ctx.reply(`🕒 ${zone}\n${now}`)
    } catch {
      return ctx.reply('Timezone tidak valid.')
    }
  }, { usage: 'time [Area/City]' }),

  command('calc', ['calculate'], 'General', 'Hitung ekspresi matematika dasar.', async ctx => {
    const expr = ctx.args.join('').trim()
    if (!expr || expr.length > 100 || !/^[0-9+\-*/().%\s]+$/.test(expr)) {
      return ctx.reply('Gunakan angka dan operator + - * / % ( ), maksimal 100 karakter.')
    }
    try {
      const result = Function(`"use strict"; return (${expr})`)()
      if (!Number.isFinite(result)) throw new Error('non-finite')
      return ctx.reply(`🧮 ${expr} = ${result}`)
    } catch {
      return ctx.reply('Ekspresi tidak valid.')
    }
  }, { usage: 'calc 12*(5+2)' }),

  command('base64', [], 'Utility', 'Encode/decode teks Base64.', async ctx => {
    const mode = ctx.args.shift()?.toLowerCase()
    const text = ctx.args.join(' ')
    if (!['encode', 'decode'].includes(mode) || !text) {
      return ctx.reply(`Pakai: ${ctx.prefix}base64 encode <text>\natau ${ctx.prefix}base64 decode <base64>`)
    }
    try {
      const result = mode === 'encode'
        ? Buffer.from(text, 'utf8').toString('base64')
        : Buffer.from(text, 'base64').toString('utf8')
      return ctx.reply(truncate(result, 7000))
    } catch {
      return ctx.reply('Input Base64 tidak valid.')
    }
  }, { usage: 'base64 encode|decode <text>' }),

  command('hash', ['sha256'], 'Utility', 'Buat SHA-256 dari teks.', async ctx => {
    const text = ctx.args.join(' ')
    if (!text) return ctx.reply(`Pakai: ${ctx.prefix}hash <text>`)
    const digest = crypto.createHash('sha256').update(text, 'utf8').digest('hex')
    return ctx.reply(digest)
  }, { usage: 'hash <text>' }),

  command('coin', ['coinflip'], 'Fun', 'Lempar koin.', async ctx => {
    return ctx.reply(Math.random() < 0.5 ? '🪙 Heads' : '🪙 Tails')
  }),

  command('dice', [], 'Fun', 'Lempar dadu 1–6.', async ctx => {
    return ctx.reply(`🎲 ${Math.floor(Math.random() * 6) + 1}`)
  }),

  command('afk', [], 'User', 'Set status AFK dengan alasan.', async ctx => {
    const reason = ctx.args.join(' ') || 'tidak ada alasan'
    ctx.store.user(ctx.userKey).afk = { since: Date.now(), reason: truncate(reason, 300) }
    await ctx.store.persist()
    return ctx.reply(`💤 AFK aktif: ${reason}`)
  }, { usage: 'afk [reason]' }),

  command('profile', ['me'], 'User', 'Lihat profil runtime user.', async ctx => {
    const user = ctx.store.user(ctx.userKey)
    const warningCount = isGroupJid(ctx.jid) ? ctx.store.warnCount(ctx.jid, ctx.userKey) : 0
    return ctx.reply(
      `👤 ${safeIdentity(ctx.sender)}\nAFK: ${user.afk ? 'aktif' : 'tidak aktif'}\nWarnings (chat ini): ${warningCount}`
    )
  }),

  command('pp', ['profilepic'], 'Utility', 'Ambil foto profil target.', async ctx => {
    const target = isGroupJid(ctx.jid)
      ? (await resolveTarget(ctx, await requireGroup(ctx)))
      : (targetFromContext(ctx.message.message, ctx.text) || ctx.sender)
    if (!target) return ctx.reply('Mention atau reply target.')

    try {
      const url = await ctx.sock.profilePictureUrl(target, 'image')
      return ctx.sock.sendMessage(ctx.jid, {
        image: { url },
        caption: `Profile picture • ${numberFromJid(target)}`
      }, { quoted: ctx.message })
    } catch {
      return ctx.reply('Foto profil target tidak tersedia atau tidak dapat diakses.')
    }
  }, { usage: 'pp [@user]' }),

  command('poll', [], 'Utility', 'Buat polling dari judul dan opsi dipisah |.', async ctx => {
    const parts = ctx.args.join(' ').split('|').map(item => item.trim()).filter(Boolean)
    const name = parts.shift()
    if (!name || parts.length < 2) {
      return ctx.reply(`Pakai: ${ctx.prefix}poll Judul | Opsi 1 | Opsi 2`)
    }
    if (name.length > 200 || parts.length > 12 || parts.some(item => item.length > 100)) {
      return ctx.reply('Judul maksimal 200 karakter, opsi 2–12 item, masing-masing maksimal 100 karakter.')
    }
    return ctx.sock.sendMessage(ctx.jid, {
      poll: {
        name,
        values: parts,
        selectableCount: 1,
        toAnnouncementGroup: false
      }
    })
  }, { usage: 'poll <judul> | <opsi 1> | <opsi 2> [...]' }),

  command('pin', [], 'Group', 'Pin pesan yang direply.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const key = getQuotedMessage(ctx.message.message)?.key
    if (!key?.id) return ctx.reply(`Reply pesan lalu gunakan ${ctx.prefix}pin`)
    await ctx.sock.sendMessage(ctx.jid, {
      pin: { type: 1, time: 86400, key }
    })
    return ctx.reply('📌 Pesan dipin selama 24 jam.')
  }, { usage: 'pin (reply pesan)' }),

  command('unpin', [], 'Group', 'Unpin pesan yang direply.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const key = getQuotedMessage(ctx.message.message)?.key
    if (!key?.id) return ctx.reply(`Reply pesan lalu gunakan ${ctx.prefix}unpin`)
    await ctx.sock.sendMessage(ctx.jid, {
      pin: { type: 0, key }
    })
    return ctx.reply('📌 Pesan di-unpin.')
  }, { usage: 'unpin (reply pesan)' }),

  command('react', [], 'Utility', 'Kirim reaction ke pesan target.', async ctx => {
    const emoji = ctx.args[0] || '👍'
    if ([...emoji].length > 8) return ctx.reply('Emoji terlalu panjang.')
    const key = getQuotedMessage(ctx.message.message)?.key || ctx.message.key
    return ctx.sock.sendMessage(ctx.jid, { react: { text: emoji, key } })
  }, { usage: 'react <emoji> (atau reply pesan)' }),

  command('ai', ['ask'], 'AI', 'Tanya AI dengan memory lokal opsional.', async ctx => {
    if (!config.ai.key) return ctx.reply('Modul AI belum dikonfigurasi. Isi AI_API_KEY di .env.')
    const prompt = ctx.args.join(' ').trim()
    if (!prompt) return ctx.reply(`Tulis pertanyaan setelah ${ctx.prefix}ai`)
    if (prompt.length > 4000) return ctx.reply('Prompt terlalu panjang (maks. 4000 karakter).')

    const user = ctx.store.user(ctx.userKey)
    const history = Array.isArray(user.aiHistory) ? user.aiHistory : []
    const messages = [
      { role: 'system', content: `You are ${config.botName}, a concise WhatsApp bot. Reply in the user's language. Do not claim actions you cannot perform.` },
      ...history,
      { role: 'user', content: prompt }
    ]

    let response
    try {
      response = await aiCircuit.execute(() => fetchWithRetry(
        `${config.ai.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.ai.key}`,
            'content-type': 'application/json'
          },
          signal: AbortSignal.timeout(config.ai.timeoutMs),
          body: JSON.stringify({
            model: config.ai.model,
            messages,
            temperature: 0.7
          })
        },
        {
          retries: config.ai.maxRetries,
          baseDelayMs: config.ai.retryBaseMs
        }
      ))
      if (!response.ok) throw new Error(`AI_HTTP_${response.status}`)
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return ctx.reply('🛑 Modul AI sedang cooldown karena provider gagal berulang. Coba lagi sebentar.')
      }
      throw error
    }

    const payload = await response.json()
    const answer = payload?.choices?.[0]?.message?.content?.trim()
    if (!answer) throw new Error('AI_EMPTY_RESPONSE')

    user.aiHistory = [...history, { role: 'user', content: prompt }, { role: 'assistant', content: answer }]
      .slice(-(config.ai.maxTurns * 2))
    await ctx.store.persist()
    return ctx.reply(truncate(answer, 6000))
  }, { usage: 'ai <prompt>' }),

  command('aistatus', ['aicircuit'], 'AI', 'Lihat status dependency AI tanpa membuka API key.', async ctx => {
    const status = aiCircuit.status
    const stateLabel = status.state === 'closed'
      ? 'CLOSED'
      : status.state === 'half-open'
        ? 'HALF-OPEN'
        : 'OPEN / COOLDOWN'
    return ctx.reply([
      `🤖 AI: ${config.ai.key ? 'configured' : 'not configured'}`,
      `Model: ${config.ai.model}`,
      `Circuit: ${stateLabel}`,
      `Failures: ${status.failures}/${config.ai.circuitFailureThreshold}`,
      `Retries: ${config.ai.maxRetries}`
    ].join('\\n'))
  }),

  command('aiclear', ['resetai'], 'AI', 'Hapus memory percakapan AI milikmu.', async ctx => {
    ctx.store.user(ctx.userKey).aiHistory = []
    await ctx.store.persist()
    return ctx.reply('🧹 Memory AI dihapus.')
  }),

  command('group', ['gc'], 'Group', 'Buka atau tutup chat grup.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['open', 'close'].includes(mode)) return ctx.reply(`Pakai: ${ctx.prefix}group open|close`)
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    await ctx.sock.groupSettingUpdate(
      ctx.jid,
      mode === 'open' ? 'not_announcement' : 'announcement'
    )
    return ctx.reply(`✅ Group mode: ${mode}`)
  }),

  command('lock', [], 'Group', 'Batasi pesan hanya untuk admin.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    await ctx.sock.groupSettingUpdate(ctx.jid, 'locked')
    return ctx.reply('🔒 Group locked: hanya admin yang dapat mengirim pesan.')
  }),

  command('unlock', [], 'Group', 'Buka kembali pesan untuk semua member.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    await ctx.sock.groupSettingUpdate(ctx.jid, 'unlocked')
    return ctx.reply('🔓 Group unlocked: semua member dapat mengirim pesan.')
  }),

  command('setprefix', [], 'Group', 'Atur prefix khusus grup.', async ctx => {
    const prefix = ctx.args[0]
    await requireAdmin(ctx)
    if (!prefix || prefix === 'reset' || prefix === 'none') {
      settings(ctx).prefix = null
      await ctx.store.persist()
      return ctx.reply(`Prefix kembali ke global: ${config.prefix}`)
    }
    if (/\s/.test(prefix) || prefix.length > 3 || prefix.length === 0) {
      return ctx.reply('Prefix harus 1–3 karakter tanpa spasi.')
    }
    settings(ctx).prefix = prefix
    await ctx.store.persist()
    return ctx.reply(`Prefix grup diubah menjadi: ${prefix}`)
  }, { usage: 'setprefix <symbol>|reset' }),

  command('disable', [], 'Group', 'Nonaktifkan command tertentu dalam grup.', async ctx => {
    await requireAdmin(ctx)
    const name = ctx.args[0]?.toLowerCase()
    const cmd = name && findCommand(name)
    if (!cmd || ['menu', 'help', 'disable', 'enable', 'disabled'].includes(cmd.name)) {
      return ctx.reply('Command tidak valid untuk dinonaktifkan.')
    }
    settings(ctx).disabledCommands.includes(cmd.name)
      ? null
      : ctx.store.setCommandDisabled(ctx.jid, cmd.name, true)
    await ctx.store.persist()
    return ctx.reply(`${ctx.prefix}${cmd.name} dinonaktifkan di grup.`)
  }, { usage: 'disable <command>' }),

  command('enable', [], 'Group', 'Aktifkan kembali command tertentu.', async ctx => {
    await requireAdmin(ctx)
    const name = ctx.args[0]?.toLowerCase()
    const cmd = name && findCommand(name)
    if (!cmd) return ctx.reply('Command tidak ditemukan.')
    ctx.store.setCommandDisabled(ctx.jid, cmd.name, false)
    await ctx.store.persist()
    return ctx.reply(`${ctx.prefix}${cmd.name} diaktifkan kembali.`)
  }, { usage: 'enable <command>' }),

  command('disabled', ['disabledcmds'], 'Group', 'Lihat command yang dinonaktifkan.', async ctx => {
    await requireAdmin(ctx)
    const list = settings(ctx).disabledCommands
    return ctx.reply(list.length ? formatList('Disabled commands', list.map(n => `${ctx.prefix}${n}`)) : 'Tidak ada command yang dinonaktifkan.')
  }),

  command('filter', ['wordfilter'], 'Moderation', 'Kelola keyword filter grup.', async ctx => {
    await requireAdmin(ctx)
    const action = ctx.args.shift()?.toLowerCase()
    const group = settings(ctx)

    if (action === 'on' || action === 'off') {
      group.filterEnabled = action === 'on'
      await ctx.store.persist()
      return ctx.reply(`Keyword filter: ${group.filterEnabled ? 'ON' : 'OFF'}`)
    }

    if (action === 'mode') {
      const mode = ctx.args.shift()?.toLowerCase()
      if (!['delete', 'warn'].includes(mode)) {
        return ctx.reply(`Pakai: ${ctx.prefix}filter mode delete|warn`)
      }
      group.filterMode = mode
      await ctx.store.persist()
      return ctx.reply(`Keyword filter mode: ${mode}`)
    }

    if (action === 'add') {
      const keyword = ctx.args.join(' ').trim()
      if (!keyword) return ctx.reply(`Pakai: ${ctx.prefix}filter add <keyword>`)
      if (keyword.length > 80) return ctx.reply('Keyword maksimal 80 karakter.')
      const normalized = keyword.toLocaleLowerCase('id-ID')
      if ((group.filters?.length || 0) >= 100 && !group.filters.includes(normalized)) {
        return ctx.reply('Batas keyword filter adalah 100 item. Hapus filter lama terlebih dahulu.')
      }
      const added = addKeyword(group, keyword)
      await ctx.store.persist()
      return ctx.reply(added ? `✅ Filter ditambahkan: ${keyword}` : 'Keyword tersebut sudah ada.')
    }

    if (action === 'clear') {
      const total = group.filters?.length || 0
      group.filters = []
      await ctx.store.persist()
      return ctx.reply(total ? `🧹 ${total} keyword filter dihapus.` : 'Tidak ada keyword filter untuk dihapus.')
    }

    if (action === 'del' || action === 'remove') {
      const keyword = ctx.args.join(' ').trim()
      if (!keyword) return ctx.reply(`Pakai: ${ctx.prefix}filter del <keyword>`)
      const removed = removeKeyword(group, keyword)
      await ctx.store.persist()
      return ctx.reply(removed ? `🧹 Filter dihapus: ${keyword}` : 'Keyword tidak ditemukan.')
    }

    if (action === 'list' || !action) {
      const list = listKeywords(group)
      return ctx.reply(list.length ? formatList('Keyword filters', list) : 'Belum ada keyword filter.')
    }

    return ctx.reply(`Pakai: ${ctx.prefix}filter on|off|mode|add|del|list|clear`)
  }, { usage: 'filter on|off | mode delete|warn | add|del <keyword> | list|clear' }),

  command('antiflood', ['flood'], 'Moderation', 'Atur proteksi flood per grup.', async ctx => {
    await requireAdmin(ctx)
    const group = settings(ctx)
    const action = ctx.args.shift()?.toLowerCase()

    if (action === 'on' || action === 'off') {
      group.antiflood = action === 'on'
      await ctx.store.persist()
      return ctx.reply(`Anti-flood: ${group.antiflood ? 'ON' : 'OFF'}`)
    }

    if (action === 'status' || !action) {
      return ctx.reply(
        `Anti-flood: ${group.antiflood ? 'ON' : 'OFF'}\\nLimit: ${group.floodMax} pesan / ${Math.round(group.floodWindowMs / 1000)}s\\nMode: ${group.floodMode}`
      )
    }

    if (action === 'config') {
      const max = Number.parseInt(ctx.args[0], 10)
      const seconds = Number.parseInt(ctx.args[1], 10)
      const mode = ctx.args[2]?.toLowerCase()
      if (!Number.isInteger(max) || max < 3 || max > 20 || !Number.isInteger(seconds) || seconds < 3 || seconds > 60 || !['delete', 'warn'].includes(mode)) {
        return ctx.reply(`Pakai: ${ctx.prefix}antiflood config <3-20> <3-60s> delete|warn`)
      }
      group.floodMax = max
      group.floodWindowMs = seconds * 1000
      group.floodMode = mode
      await ctx.store.persist()
      return ctx.reply(`✅ Anti-flood disimpan: ${max} pesan / ${seconds}s / ${mode}`)
    }

    return ctx.reply(`Pakai: ${ctx.prefix}antiflood on|off|status|config <max> <seconds> delete|warn`)
  }),

  command('antilink', [], 'Group', 'Aktif/nonaktifkan filter URL.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['on', 'off'].includes(mode)) return ctx.reply(`Pakai: ${ctx.prefix}antilink on|off`)
    await requireAdmin(ctx)
    settings(ctx).antilink = mode === 'on'
    await ctx.store.persist()
    return ctx.reply(`Antilink: ${settings(ctx).antilink ? 'ON' : 'OFF'}`)
  }),

  command('welcome', [], 'Group', 'Aktif/nonaktifkan welcome.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['on', 'off'].includes(mode)) return ctx.reply(`Pakai: ${ctx.prefix}welcome on|off`)
    await requireAdmin(ctx)
    settings(ctx).welcome = mode === 'on'
    await ctx.store.persist()
    return ctx.reply(`Welcome: ${settings(ctx).welcome ? 'ON' : 'OFF'}`)
  }),

  command('setwelcome', [], 'Group', 'Atur teks welcome. Gunakan @user.', async ctx => {
    await requireAdmin(ctx)
    const text = ctx.args.join(' ').trim()
    if (!text) return ctx.reply(`Pakai: ${ctx.prefix}setwelcome Selamat datang @user!`)
    if (text.length > 500) return ctx.reply('Teks welcome maksimal 500 karakter.')
    settings(ctx).welcomeText = text
    await ctx.store.persist()
    return ctx.reply('✅ Template welcome disimpan.')
  }, { usage: 'setwelcome <text>' }),

  command('goodbye', [], 'Group', 'Aktif/nonaktifkan goodbye.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['on', 'off'].includes(mode)) return ctx.reply(`Pakai: ${ctx.prefix}goodbye on|off`)
    await requireAdmin(ctx)
    settings(ctx).goodbye = mode === 'on'
    await ctx.store.persist()
    return ctx.reply(`Goodbye: ${settings(ctx).goodbye ? 'ON' : 'OFF'}`)
  }),

  command('setgoodbye', [], 'Group', 'Atur teks goodbye. Gunakan @user.', async ctx => {
    await requireAdmin(ctx)
    const text = ctx.args.join(' ').trim()
    if (!text) return ctx.reply(`Pakai: ${ctx.prefix}setgoodbye Sampai jumpa @user!`)
    if (text.length > 500) return ctx.reply('Teks goodbye maksimal 500 karakter.')
    settings(ctx).goodbyeText = text
    await ctx.store.persist()
    return ctx.reply('✅ Template goodbye disimpan.')
  }, { usage: 'setgoodbye <text>' }),

  command('tagall', ['everyone'], 'Group', 'Mention semua member grup.', async ctx => {
    const meta = await requireAdmin(ctx)
    const mentions = meta.participants.map(p => p.id)
    const text = ctx.args.join(' ') || 'Semua member 👋'
    return ctx.sock.sendMessage(ctx.jid, { text, mentions })
  }),

  command('tagadmin', [], 'Group', 'Mention semua admin grup.', async ctx => {
    const meta = await requireGroup(ctx)
    const mentions = [...adminSet(meta)]
    if (!mentions.length) return ctx.reply('Tidak ada admin yang terdeteksi.')
    return ctx.sock.sendMessage(ctx.jid, {
      text: ctx.args.join(' ') || 'Attention admin 👮',
      mentions
    })
  }),

  command('kick', ['remove'], 'Moderation', 'Keluarkan member yang ditargetkan.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const target = await resolveTarget(ctx, meta)
    if (!target) return ctx.reply('Mention atau reply pesan member target.')
    if (isAdmin(meta, target, ctx.sock)) return ctx.reply('Target adalah admin. Cabut adminnya dulu.')
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], 'remove')
    return ctx.reply(`✅ @${numberFromJid(target)} diproses untuk dikeluarkan.`, { mentions: [target] })
  }),

  command('promote', [], 'Moderation', 'Jadikan target admin.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const target = await resolveTarget(ctx, meta)
    if (!target) return ctx.reply('Mention atau reply pesan member target.')
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], 'promote')
    return ctx.reply(`✅ @${numberFromJid(target)} dipromosikan.`, { mentions: [target] })
  }),

  command('demote', [], 'Moderation', 'Cabut status admin target.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const target = await resolveTarget(ctx, meta)
    if (!target) return ctx.reply('Mention atau reply pesan admin target.')
    if (ctx.isOwner && target === ctx.sender) {
      return ctx.reply('Owner tidak bisa menghapus status adminnya sendiri lewat command ini.')
    }
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], 'demote')
    return ctx.reply(`✅ @${numberFromJid(target)} didemote.`, { mentions: [target] })
  }),

  command('warn', [], 'Moderation', 'Tambahkan peringatan ke member.', async ctx => {
    const meta = await requireAdmin(ctx)
    const target = await resolveTarget(ctx, meta)
    if (!target) return ctx.reply('Mention atau reply pesan member target.')
    if (isAdmin(meta, target, ctx.sock)) return ctx.reply('Target adalah admin.')
    const userKey = ctx.store.canonicalParticipant(meta, target)
    const reason = ctx.args.filter(arg => !arg.startsWith('@')).join(' ') || 'tanpa alasan'
    const count = ctx.store.addWarn(ctx.jid, userKey, truncate(reason, 300))
    await ctx.store.persist()

    if (count >= config.warnLimit) {
      await requireBotAdmin(ctx, meta)
      ctx.store.resetWarn(ctx.jid, userKey)
      await ctx.store.persist()
      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], 'remove')
        return ctx.reply(
          `⛔ @${numberFromJid(target)} mencapai batas warning (${config.warnLimit}) dan diproses untuk dikeluarkan.`,
          { mentions: [target] }
        )
      } catch {
        return ctx.reply(
          `⚠️ @${numberFromJid(target)} mencapai batas warning, tetapi pengeluaran gagal.`,
          { mentions: [target] }
        )
      }
    }

    return ctx.reply(
      `⚠️ @${numberFromJid(target)} mendapat warning ${count}/${config.warnLimit}.\nAlasan: ${reason}`,
      { mentions: [target] }
    )
  }, { usage: 'warn @user [reason]' }),

  command('warnings', ['warns'], 'Moderation', 'Lihat warning target.', async ctx => {
    await requireGroup(ctx)
    const meta = await requireGroup(ctx)
    const target = await resolveTarget(ctx, meta)
    const targetJid = target || ctx.sender
    const targetKey = target ? ctx.store.canonicalParticipant(meta, target) : ctx.userKey
    const count = ctx.store.warnCount(ctx.jid, targetKey)
    return ctx.reply(`⚠️ @${numberFromJid(targetJid)}: ${count}/${config.warnLimit} warning.`, { mentions: [targetJid] })
  }),

  command('resetwarn', ['clearwarn'], 'Moderation', 'Reset warning target.', async ctx => {
    await requireAdmin(ctx)
    const meta = await requireGroup(ctx)
    const target = await resolveTarget(ctx, meta)
    if (!target) return ctx.reply('Mention atau reply target.')
    const targetKey = ctx.store.canonicalParticipant(meta, target)
    ctx.store.resetWarn(ctx.jid, targetKey)
    await ctx.store.persist()
    return ctx.reply(`🧹 Warning @${numberFromJid(target)} direset.`, { mentions: [target] })
  }),

  command('groupinfo', ['ginfo'], 'Group', 'Lihat metadata grup.', async ctx => {
    const meta = await requireGroup(ctx)
    return ctx.reply(
      `*${meta.subject || 'Group'}*\nMembers: ${meta.participants.length}\nAdmins: ${adminSet(meta).size}\nJID: ${ctx.jid}`
    )
  }),

  command('subject', [], 'Group', 'Ubah nama grup.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const subject = ctx.args.join(' ').trim()
    if (!subject) return ctx.reply(`Pakai: ${ctx.prefix}subject <nama>`)
    if (subject.length > 100) return ctx.reply('Nama grup maksimal 100 karakter.')
    await ctx.sock.groupUpdateSubject(ctx.jid, subject)
    return ctx.reply('✅ Subject grup diperbarui.')
  }, { usage: 'subject <nama>' }),

  command('desc', ['description'], 'Group', 'Ubah deskripsi grup.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const description = ctx.args.join(' ').trim()
    if (!description) return ctx.reply(`Pakai: ${ctx.prefix}desc <deskripsi>`)
    if (description.length > 2048) return ctx.reply('Deskripsi terlalu panjang.')
    await ctx.sock.groupUpdateDescription(ctx.jid, description)
    return ctx.reply('✅ Deskripsi grup diperbarui.')
  }, { usage: 'desc <text>' }),

  command('admins', [], 'Group', 'Daftar admin grup.', async ctx => {
    const meta = await requireGroup(ctx)
    const admins = adminParticipants(meta)
    const mentions = admins.map(p => p.id)
    return ctx.sock.sendMessage(ctx.jid, {
      text: admins.map((p, i) => `${i + 1}. @${numberFromJid(p.id)}`).join('\n'),
      mentions
    })
  }),

  command('invite', [], 'Group', 'Ambil link undangan grup.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const code = await ctx.sock.groupInviteCode(ctx.jid)
    return ctx.reply(`https://chat.whatsapp.com/${code}`)
  }),

  command('ephemeral', [], 'Group', 'Atur pesan sementara grup.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const mode = (ctx.args[0] || 'off').toLowerCase()
    const values = { off: 0, '24h': 86400, '7d': 604800, '90d': 7776000 }
    if (!(mode in values)) return ctx.reply(`Pakai: ${ctx.prefix}ephemeral off|24h|7d|90d`)
    await ctx.sock.groupToggleEphemeral(ctx.jid, values[mode])
    return ctx.reply(`🕐 Ephemeral group: ${mode}`)
  }),

  command('requests', ['joinrequests'], 'Group', 'Lihat permintaan join grup.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const requests = await ctx.sock.groupRequestParticipantsList(ctx.jid)
    if (!requests.length) return ctx.reply('Tidak ada join request.')
    return ctx.reply(requests.map((item, i) => {
      const jid = item.jid || item.id || item.lid || ''
      return `${i + 1}. ${jid}`
    }).join('\\n'))
  }),

  command('approve', [], 'Group', 'Setujui join request.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const targets = ctx.args.filter(Boolean)
    if (!targets.length) return ctx.reply(`Pakai: ${ctx.prefix}approve <jid> [...]`)
    const results = await ctx.sock.groupRequestParticipantsUpdate(ctx.jid, targets, 'approve')
    return ctx.reply(results.map(item => `${item.jid}: ${item.status}`).join('\\n'))
  }),

  command('reject', [], 'Group', 'Tolak join request.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const targets = ctx.args.filter(Boolean)
    if (!targets.length) return ctx.reply(`Pakai: ${ctx.prefix}reject <jid> [...]`)
    const results = await ctx.sock.groupRequestParticipantsUpdate(ctx.jid, targets, 'reject')
    return ctx.reply(results.map(item => `${item.jid}: ${item.status}`).join('\\n'))
  }),

  command('addmode', [], 'Group', 'Atur siapa yang dapat menambahkan anggota.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const mode = ctx.args[0]?.toLowerCase()
    if (!['admin_add', 'all_member_add'].includes(mode)) {
      return ctx.reply(`Pakai: ${ctx.prefix}addmode admin_add|all_member_add`)
    }
    await ctx.sock.groupMemberAddMode(ctx.jid, mode)
    return ctx.reply(`👥 Add mode: ${mode}`)
  }),

  command('joinapproval', ['joinapprove'], 'Group', 'Aktif/nonaktifkan persetujuan join.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    const mode = ctx.args[0]?.toLowerCase()
    if (!['on', 'off'].includes(mode)) {
      return ctx.reply(`Pakai: ${ctx.prefix}joinapproval on|off`)
    }
    await ctx.sock.groupJoinApprovalMode(ctx.jid, mode)
    return ctx.reply(`🔐 Join approval: ${mode.toUpperCase()}`)
  }),

  command('revoke', ['resetlink'], 'Group', 'Cabut link undangan grup.', async ctx => {
    await requireAdmin(ctx)
    await requireBotAdmin(ctx)
    await ctx.sock.groupRevokeInvite(ctx.jid)
    return ctx.reply('🔐 Link undangan grup sudah direset.')
  }),

  command('groupconfig', ['gsettings'], 'Group', 'Lihat konfigurasi Nexa di grup.', async ctx => {
    const meta = await requireGroup(ctx)
    const group = settings(ctx)
    return ctx.reply(
      `*${meta.subject || 'Group'}*\\nPrefix: ${group.prefix || ctx.prefix}\\nAntilink: ${group.antilink ? 'ON' : 'OFF'}\\nAnti-flood: ${group.antiflood ? 'ON' : 'OFF'} (${group.floodMax}/${Math.round(group.floodWindowMs / 1000)}s, ${group.floodMode})\\nWelcome: ${group.welcome ? 'ON' : 'OFF'}\\nGoodbye: ${group.goodbye ? 'ON' : 'OFF'}\\nFilter: ${group.filterEnabled ? 'ON' : 'OFF'} (${group.filterMode})\\nFilters: ${group.filters.length || 'none'}\\nJoin approval: WhatsApp-managed\\nDisabled commands: ${group.disabledCommands.length || 'none'}`
    )
  }),

  command('resetgroup', [], 'Group', 'Reset konfigurasi Nexa untuk grup.', async ctx => {
    await requireAdmin(ctx)
    const group = settings(ctx)
    group.prefix = null
    group.antilink = false
    group.welcome = false
    group.goodbye = false
    group.welcomeText = '👋 Selamat datang @user di grup!'
    group.goodbyeText = '👋 @user keluar dari grup.'
    group.disabledCommands = []
    group.antiflood = false
    group.floodMax = 6
    group.floodWindowMs = 5000
    group.floodMode = 'delete'
    group.filters = []
    group.filterEnabled = false
    group.filterMode = 'delete'
    group.warns = {}
    await ctx.store.persist()
    return ctx.reply('🧹 Konfigurasi Nexa untuk grup sudah direset.')
  }),

  command('whois', ['user'], 'Group', 'Lihat identitas target di grup.', async ctx => {
    const meta = await requireGroup(ctx)
    const target = await resolveTarget(ctx, meta)
    if (!target) return ctx.reply('Mention atau reply pesan target.')
    const participant = meta.participants.find(item => participantJids(item).includes(target))
    if (!participant) return ctx.reply('Member tidak ditemukan di metadata grup.')
    const roles = participant.admin === 'superadmin'
      ? 'superadmin'
      : participant.admin === 'admin'
        ? 'admin'
        : 'member'

    if (ctx.args[0]?.toLowerCase() === 'full') {
      await requireOwner(ctx)
      return ctx.reply([
        `JID: ${participant.id || '-'}`,
        `Phone: ${participant.phoneNumber || '-'}`,
        `LID: ${participant.lid || '-'}`,
        `Role: ${roles}`
      ].join('\\n'))
    }

    return ctx.reply([
      `Identity: ${safeIdentity(participant.phoneNumber || participant.id || participant.lid)}`,
      `Role: ${roles}`
    ].join('\\n'))
  }),

  command('sticker', ['s', 'stiker'], 'Media', 'Ubah gambar menjadi sticker.', async ctx => {
    const image = await findMedia(ctx, 'image')
    if (!image) return ctx.reply(`Kirim atau reply gambar lalu gunakan ${ctx.prefix}sticker`)
    const input = await downloadNode(image, 'image')
    const output = await sharp(input)
      .rotate()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    return ctx.sock.sendMessage(ctx.jid, { sticker: output }, { quoted: ctx.message })
  }),

  command('toimg', ['toimage'], 'Media', 'Ubah sticker WebP menjadi PNG.', async ctx => {
    const sticker = await findMedia(ctx, 'sticker')
    if (!sticker) return ctx.reply(`Reply sticker lalu gunakan ${ctx.prefix}toimg`)
    const input = await downloadNode(sticker, 'sticker')
    const output = await sharp(input).png().toBuffer()
    return ctx.sock.sendMessage(ctx.jid, {
      image: output,
      caption: 'Nexa • sticker → image'
    }, { quoted: ctx.message })
  }),

  command('setname', [], 'Owner', 'Ubah nama profil WhatsApp Nexa.', async ctx => {
    await requireOwner(ctx)
    const name = ctx.args.join(' ').trim()
    if (!name) return ctx.reply(`Pakai: ${ctx.prefix}setname <nama>`)
    if (name.length > 25) return ctx.reply('Nama profil maksimal 25 karakter.')
    await ctx.sock.updateProfileName(name)
    return ctx.reply(`✅ Nama profil Nexa diubah menjadi: ${name}`)
  }, { usage: 'setname <name>' }),

  command('setabout', [], 'Owner', 'Ubah About/status profil WhatsApp Nexa.', async ctx => {
    await requireOwner(ctx)
    const about = ctx.args.join(' ').trim()
    if (about.length > 139) return ctx.reply('About maksimal 139 karakter.')
    await ctx.sock.updateProfileStatus(about)
    return ctx.reply('✅ About profil Nexa diperbarui.')
  }, { usage: 'setabout <text>' }),

  command('delete', ['del'], 'Moderation', 'Hapus pesan yang direply dari grup.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const quoted = getQuotedMessage(ctx.message.message)
    if (!quoted?.key?.id) return ctx.reply(`Reply pesan lalu gunakan ${ctx.prefix}delete`)
    await ctx.sock.sendMessage(ctx.jid, { delete: quoted.key })
    return ctx.reply('🗑️ Pesan dihapus.')
  }, { usage: 'delete (reply pesan)' }),

  command('chatstats', ['stats'], 'General', 'Lihat statistik chat saat ini.', async ctx => {
    const group = isGroupJid(ctx.jid) ? settings(ctx) : null
    const user = ctx.store.user(ctx.userKey)
    const lines = [
      `Messages total: ${ctx.store.data.meta.messages}`,
      `Commands total: ${ctx.store.data.meta.commands}`,
      `Your messages: ${user.messages}`
    ]
    if (group) {
      lines.push(`Group messages: ${group.stats.messages}`)
      lines.push(`Group commands: ${group.stats.commands}`)
      lines.push(`Keyword filter: ${group.filterEnabled ? 'ON' : 'OFF'}`)
    }
    return ctx.reply(lines.join('\\n'))
  }),

  command('setgrouppp', ['grouppp'], 'Group', 'Atur foto profil grup dari gambar.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const image = await findMedia(ctx, 'image')
    if (!image) return ctx.reply(`Kirim atau reply gambar lalu gunakan ${ctx.prefix}setgrouppp`)
    const input = await downloadNode(image, 'image')
    await ctx.sock.updateProfilePicture(ctx.jid, input)
    return ctx.reply('✅ Foto profil grup diperbarui.')
  }, { usage: 'setgrouppp (reply/kirim gambar)' }),

  command('setpp', ['setbotpp'], 'Owner', 'Atur foto profil Nexa.', async ctx => {
    await requireOwner(ctx)
    const image = await findMedia(ctx, 'image')
    if (!image) return ctx.reply(`Kirim atau reply gambar lalu gunakan ${ctx.prefix}setpp`)
    const input = await downloadNode(image, 'image')
    await ctx.sock.updateProfilePicture(ctx.sock.user?.id || '', input)
    return ctx.reply('✅ Foto profil Nexa diperbarui.')
  }, { usage: 'setpp (reply/kirim gambar)' }),

  command('block', [], 'Owner', 'Blokir target contact.', async ctx => {
    await requireOwner(ctx)
    const target = targetFromContext(ctx.message.message, ctx.text) || ctx.args[0]
    if (!target) return ctx.reply(`Pakai: ${ctx.prefix}block @user atau reply pesan`)
    await ctx.sock.updateBlockStatus(target, 'block')
    return ctx.reply('🚫 Contact diblokir.')
  }, { usage: 'block @user (atau reply)' }),

  command('unblock', [], 'Owner', 'Buka blokir contact.', async ctx => {
    await requireOwner(ctx)
    const target = targetFromContext(ctx.message.message, ctx.text) || ctx.args[0]
    if (!target) return ctx.reply(`Pakai: ${ctx.prefix}unblock @user atau reply pesan`)
    await ctx.sock.updateBlockStatus(target, 'unblock')
    return ctx.reply('✅ Contact di-unblock.')
  }, { usage: 'unblock @user (atau reply)' }),

  command('blocklist', ['blocked'], 'Owner', 'Lihat contact yang diblokir.', async ctx => {
    await requireOwner(ctx)
    const list = await ctx.sock.fetchBlocklist()
    if (!list?.length) return ctx.reply('Blocklist kosong.')
    return ctx.reply(truncate(list.map((jid, i) => `${i + 1}. ${jid}`).join('\\n'), 10000))
  }),

  command('status', ['system'], 'Owner', 'Lihat status runtime internal.', async ctx => {
    await requireOwner(ctx)
    return ctx.reply(
      `*${config.botName} status*\nOwner: ${config.ownerName}\nUptime: ${formatDuration(process.uptime())}\nAI: ${config.ai.key ? 'configured' : 'not configured'}\nGroups: ${Object.keys(ctx.store.data.groups).length}\nUsers: ${Object.keys(ctx.store.data.users).length}\nMessages: ${ctx.store.data.meta.messages}\nCommands: ${ctx.store.data.meta.commands}`
    )
  }),

  command('listgroups', ['groups'], 'Owner', 'Lihat grup yang diikuti Nexa.', async ctx => {
    await requireOwner(ctx)
    const groups = await ctx.sock.groupFetchAllParticipating()
    const entries = Object.entries(groups)
      .map(([jid, meta]) => `${meta.subject || 'Unknown'} — ${jid}`)
      .sort((a, b) => a.localeCompare(b))
    if (!entries.length) return ctx.reply('Nexa tidak sedang berada di grup.')
    return ctx.reply(truncate(entries.join('\\n'), 10000))
  }),

  command('leave', [], 'Owner', 'Keluarkan Nexa dari grup saat ini.', async ctx => {
    await requireOwner(ctx)
    await requireGroup(ctx)
    await ctx.sock.groupLeave(ctx.jid)
  }),

  command('memory', [], 'Owner', 'Lihat penggunaan memory proses.', async ctx => {
    await requireOwner(ctx)
    const mb = value => Math.round(value / 1024 / 1024)
    const memory = process.memoryUsage()
    return ctx.reply(`RSS: ${mb(memory.rss)} MB\nHeap: ${mb(memory.heapUsed)} / ${mb(memory.heapTotal)} MB`)
  })
]

export const COMMAND_REGISTRY = new CommandRegistry(COMMANDS)
export const COMMAND_MAP = COMMAND_REGISTRY.map

export function findCommand(name) {
  return COMMAND_REGISTRY.get(name)
}

export function categories() {
  return COMMAND_REGISTRY.categories()
}

export async function handleGroupAutomation(ctx) {
  if (!isGroupJid(ctx.jid)) return false

  const group = settings(ctx)
  if (!group.antilink || !isLikelyUrl(ctx.text)) return false

  try {
    const meta = await ctx.sock.groupMetadata(ctx.jid)
    if (isAdmin(meta, ctx.sender, ctx.sock) || (ctx.senderAlt && isAdmin(meta, ctx.senderAlt, ctx.sock))) return false
    if (!isBotAdmin(ctx.sock, meta)) return false

    await ctx.sock.sendMessage(ctx.jid, { delete: ctx.message.key })
    await ctx.sock.sendMessage(ctx.jid, {
      text: `⚠️ @${numberFromJid(ctx.sender)}: link terdeteksi dan dihapus.`,
      mentions: [ctx.sender]
    })
  } catch (error) {
    ctx.logger.warn({ err: error }, 'antilink handler failed')
  }
  return true
}
