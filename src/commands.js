import sharp from 'sharp'
import { config } from './config.js'
import {
  downloadNode,
  extractMentions,
  formatDuration,
  getMediaNode,
  getQuotedMessage,
  isGroupJid,
  isLikelyUrl,
  isOwner,
  numberFromJid
} from './utils.js'

function groupAdmins(meta) {
  return new Set(meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id))
}

async function requireGroup(ctx) {
  if (!isGroupJid(ctx.jid)) throw new Error('GROUP_ONLY')
  return ctx.sock.groupMetadata(ctx.jid)
}

async function requireAdmin(ctx, meta = null) {
  const metadata = meta || await requireGroup(ctx)
  if (!groupAdmins(metadata).has(ctx.sender)) throw new Error('ADMIN_ONLY')
  return metadata
}

async function requireBotAdmin(ctx, meta = null) {
  const metadata = meta || await requireGroup(ctx)
  const bot = ctx.sock.user?.id?.split(':')[0]
  if (!groupAdmins(metadata).has(bot)) throw new Error('BOT_ADMIN_ONLY')
  return metadata
}

async function findImage(ctx) {
  const direct = getMediaNode(ctx.message.message)
  if (direct?.type === 'image') return direct.node

  const quoted = getQuotedMessage(ctx.message.message)
  const quotedMedia = quoted ? getMediaNode(quoted.message) : null
  return quotedMedia?.type === 'image' ? quotedMedia.node : null
}

function command(name, aliases, category, description, run) {
  return { name, aliases, category, description, run }
}

export const COMMANDS = [
  command('menu', ['help', 'start'], 'General', 'Tampilkan semua fitur.', async ctx => {
    const categories = new Map()
    for (const item of COMMANDS) {
      if (!categories.has(item.category)) categories.set(item.category, [])
      categories.get(item.category).push(item)
    }

    const lines = [`*${config.botName}*`, 'All-in-one WhatsApp bot', '']
    for (const [category, list] of categories) {
      lines.push(`*${category}*`)
      for (const item of list) lines.push(`• ${ctx.prefix}${item.name} — ${item.description}`)
      lines.push('')
    }
    lines.push(`Prefix: ${ctx.prefix}`)
    return ctx.reply(lines.join('\n'))
  }),

  command('ping', ['p'], 'General', 'Cek respons bot.', async ctx => {
    const t0 = Date.now()
    const sent = await ctx.reply('🏓 Checking…')
    const ms = Date.now() - t0
    if (sent?.key) await ctx.sock.sendMessage(ctx.jid, { text: `Pong: ${ms} ms` })
  }),

  command('runtime', ['uptime'], 'General', 'Lihat uptime runtime.', async ctx => {
    return ctx.reply(`⏱️ Uptime: ${formatDuration(process.uptime())}\nNode: ${process.version}`)
  }),

  command('about', ['botinfo'], 'General', 'Info tentang Nexa.', async ctx => {
    return ctx.reply(`*${config.botName}*\nModular all-in-one WhatsApp bot.\nEngine: Baileys\nRuntime: ${process.version}`)
  }),

  command('id', ['jid'], 'General', 'Tampilkan chat dan sender JID.', async ctx => {
    return ctx.reply(`Chat: ${ctx.jid}\nSender: ${ctx.sender}\nNumber: ${numberFromJid(ctx.sender)}`)
  }),

  command('time', [], 'General', 'Tampilkan waktu berdasarkan timezone.', async ctx => {
    const zone = ctx.args[0] || 'Asia/Jakarta'
    try {
      const now = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: zone
      }).format(new Date())
      return ctx.reply(`🕒 ${zone}\n${now}`)
    } catch {
      return ctx.reply('Timezone tidak valid. Contoh: Asia/Jakarta')
    }
  }),

  command('calc', ['calculate'], 'General', 'Hitung ekspresi matematika dasar.', async ctx => {
    const expr = ctx.args.join('').trim()
    if (!expr || !/^[0-9+\-*/().%\s]+$/.test(expr)) {
      return ctx.reply('Gunakan angka dan operator: + - * / % ( )')
    }

    try {
      const result = Function(`"use strict"; return (${expr})`)()
      if (!Number.isFinite(result)) throw new Error('non-finite')
      return ctx.reply(`🧮 ${expr} = ${result}`)
    } catch {
      return ctx.reply('Ekspresi tidak valid.')
    }
  }),

  command('afk', [], 'General', 'Set status AFK.', async ctx => {
    const reason = ctx.args.join(' ') || 'tidak ada alasan'
    ctx.store.user(ctx.sender).afk = { since: Date.now(), reason }
    await ctx.store.persist()
    return ctx.reply(`AFK aktif: ${reason}`)
  }),

  command('profile', ['me'], 'General', 'Lihat status runtime profil.', async ctx => {
    const user = ctx.store.user(ctx.sender)
    return ctx.reply(`👤 ${ctx.sender}\nAFK: ${user.afk ? 'aktif' : 'tidak aktif'}`)
  }),

  command('group', ['gc'], 'Group', 'Buka/tutup chat grup.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['open', 'close'].includes(mode)) return ctx.reply('Pakai: .group open atau .group close')
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    await ctx.sock.groupSettingUpdate(ctx.jid, mode === 'open' ? 'not_announcement' : 'announcement')
    return ctx.reply(`Group mode: ${mode}`)
  }),

  command('antilink', [], 'Group', 'Aktif/nonaktifkan filter URL.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['on', 'off'].includes(mode)) return ctx.reply('Pakai: .antilink on atau .antilink off')
    await requireAdmin(ctx)
    const settings = ctx.store.group(ctx.jid)
    settings.antilink = mode === 'on'
    await ctx.store.persist()
    return ctx.reply(`Antilink: ${settings.antilink ? 'ON' : 'OFF'}`)
  }),

  command('welcome', [], 'Group', 'Aktif/nonaktifkan welcome.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['on', 'off'].includes(mode)) return ctx.reply('Pakai: .welcome on atau .welcome off')
    await requireAdmin(ctx)
    const settings = ctx.store.group(ctx.jid)
    settings.welcome = mode === 'on'
    await ctx.store.persist()
    return ctx.reply(`Welcome: ${settings.welcome ? 'ON' : 'OFF'}`)
  }),

  command('goodbye', [], 'Group', 'Aktif/nonaktifkan goodbye.', async ctx => {
    const mode = ctx.args[0]?.toLowerCase()
    if (!['on', 'off'].includes(mode)) return ctx.reply('Pakai: .goodbye on atau .goodbye off')
    await requireAdmin(ctx)
    const settings = ctx.store.group(ctx.jid)
    settings.goodbye = mode === 'on'
    await ctx.store.persist()
    return ctx.reply(`Goodbye: ${settings.goodbye ? 'ON' : 'OFF'}`)
  }),

  command('tagall', ['everyone'], 'Group', 'Mention semua member grup.', async ctx => {
    const meta = await requireAdmin(ctx)
    const mentions = meta.participants.map(p => p.id)
    const text = ctx.args.join(' ') || 'Semua member 👋'
    return ctx.sock.sendMessage(ctx.jid, { text, mentions })
  }),

  command('kick', ['remove'], 'Group', 'Keluarkan member yang di-mention.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const mentions = extractMentions(ctx.message.message, ctx.text)
    if (!mentions.length) return ctx.reply('Mention member target.')
    await ctx.sock.groupParticipantsUpdate(ctx.jid, mentions, 'remove')
    return ctx.reply('Role member diproses.')
  }),

  command('promote', [], 'Group', 'Jadikan member admin.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const mentions = extractMentions(ctx.message.message, ctx.text)
    if (!mentions.length) return ctx.reply('Mention member target.')
    await ctx.sock.groupParticipantsUpdate(ctx.jid, mentions, 'promote')
    return ctx.reply('Promote diproses.')
  }),

  command('demote', [], 'Group', 'Cabut status admin.', async ctx => {
    const meta = await requireAdmin(ctx)
    await requireBotAdmin(ctx, meta)
    const mentions = extractMentions(ctx.message.message, ctx.text)
    if (!mentions.length) return ctx.reply('Mention admin target.')
    await ctx.sock.groupParticipantsUpdate(ctx.jid, mentions, 'demote')
    return ctx.reply('Demote diproses.')
  }),

  command('groupinfo', ['ginfo'], 'Group', 'Lihat informasi grup.', async ctx => {
    const meta = await requireGroup(ctx)
    return ctx.reply(`*${meta.subject}*\nMembers: ${meta.participants.length}\nAdmins: ${groupAdmins(meta).size}\nJID: ${ctx.jid}`)
  }),

  command('sticker', ['s', 'stiker'], 'Media', 'Ubah gambar menjadi sticker.', async ctx => {
    const image = await findImage(ctx)
    if (!image) return ctx.reply('Kirim/reply gambar lalu gunakan .sticker')
    const input = await downloadNode(image, 'image')
    const output = await sharp(input)
      .rotate()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    return ctx.sock.sendMessage(ctx.jid, { sticker: output }, { quoted: ctx.message })
  }),

  command('ai', ['ask'], 'AI', 'Tanya AI melalui endpoint OpenAI-compatible.', async ctx => {
    if (!config.ai.key) return ctx.reply('Modul AI belum dikonfigurasi. Isi AI_API_KEY di .env.')
    const prompt = ctx.args.join(' ').trim()
    if (!prompt) return ctx.reply('Tulis pertanyaan setelah .ai')
    if (prompt.length > 4000) return ctx.reply('Prompt terlalu panjang (maks. 4000 karakter).')

    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.ai.key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: `You are ${config.botName}, a concise WhatsApp bot. Reply in the user's language.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    })

    if (!response.ok) throw new Error(`AI_HTTP_${response.status}`)
    const payload = await response.json()
    const answer = payload?.choices?.[0]?.message?.content?.trim()
    if (!answer) throw new Error('AI_EMPTY_RESPONSE')
    return ctx.reply(answer.slice(0, 6000))
  }),

  command('status', ['system'], 'Owner', 'Lihat status konfigurasi internal.', async ctx => {
    if (!isOwner(ctx.sender, config.ownerNumber)) throw new Error('OWNER_ONLY')
    return ctx.reply(
      `Nexa status\nAI: ${config.ai.key ? 'configured' : 'not configured'}\nPrefix: ${config.prefix}\nGroups stored: ${Object.keys(ctx.store.data.groups).length}`
    )
  })
]

export const COMMAND_MAP = new Map()
for (const item of COMMANDS) {
  COMMAND_MAP.set(item.name, item)
  for (const alias of item.aliases) COMMAND_MAP.set(alias, item)
}

export function findCommand(name) {
  return COMMAND_MAP.get(name.toLowerCase())
}

export function categories() {
  const result = new Map()
  for (const item of COMMANDS) {
    if (!result.has(item.category)) result.set(item.category, [])
    result.get(item.category).push(item)
  }
  return result
}

export async function handleGroupAutomation(ctx) {
  if (!isGroupJid(ctx.jid)) return false

  const settings = ctx.store.group(ctx.jid)
  if (!settings.antilink || !isLikelyUrl(ctx.text)) return false

  try {
    const meta = await ctx.sock.groupMetadata(ctx.jid)
    if (groupAdmins(meta).has(ctx.sender)) return false
    await requireBotAdmin(ctx, meta)
    await ctx.sock.sendMessage(ctx.jid, { delete: ctx.message.key })
    await ctx.sock.sendMessage(ctx.jid, {
      text: `⚠️ @${numberFromJid(ctx.sender)}: link terdeteksi dan dihapus.`,
      mentions: [ctx.sender]
    })
  } catch (error) {
    if (error.message !== 'BOT_ADMIN_ONLY') ctx.logger.warn({ err: error }, 'antilink failed')
  }
  return true
}
