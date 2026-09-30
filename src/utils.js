import { downloadContentFromMessage } from '@whiskeysockets/baileys'

export const normalizeJid = (jid = '') => jid.split(':')[0]
export const numberFromJid = (jid = '') => normalizeJid(jid).split('@')[0]
export const isGroupJid = (jid = '') => jid.endsWith('@g.us')
export const isOwner = (jid, ownerNumber) => Boolean(ownerNumber) && numberFromJid(jid) === ownerNumber

export function unwrapMessage(message = {}) {
  return message?.ephemeralMessage?.message
    || message?.viewOnceMessage?.message
    || message?.viewOnceMessageV2?.message
    || message?.documentWithCaptionMessage?.message
    || message
}

export function getMessageText(message) {
  const m = unwrapMessage(message)
  return m?.conversation
    || m?.extendedTextMessage?.text
    || m?.imageMessage?.caption
    || m?.videoMessage?.caption
    || m?.documentMessage?.caption
    || ''
}

export function getMediaNode(message) {
  const m = unwrapMessage(message)
  if (m?.imageMessage) return { type: 'image', node: m.imageMessage }
  if (m?.videoMessage) return { type: 'video', node: m.videoMessage }
  return null
}

export function getQuotedMessage(message) {
  const m = unwrapMessage(message)
  const ctx = m?.extendedTextMessage?.contextInfo
    || m?.imageMessage?.contextInfo
    || m?.videoMessage?.contextInfo
    || m?.documentMessage?.contextInfo

  if (!ctx?.quotedMessage) return null

  return {
    key: {
      remoteJid: message?.key?.remoteJid,
      fromMe: false,
      id: ctx.stanzaId,
      participant: ctx.participant
    },
    message: ctx.quotedMessage
  }
}

export async function downloadNode(node, type) {
  const stream = await downloadContentFromMessage(node, type)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export function mentionJid(number) {
  const clean = numberFromJid(number).replace(/\D/g, '')
  return clean ? `${clean}@s.whatsapp.net` : ''
}

export function extractMentions(message, text = '') {
  const m = unwrapMessage(message)
  const ctx = m?.extendedTextMessage?.contextInfo
    || m?.imageMessage?.contextInfo
    || m?.videoMessage?.contextInfo
    || {}

  const fromContext = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : []
  const fromText = [...text.matchAll(/@(\d{7,16})/g)].map(m => mentionJid(m[1]))
  return [...new Set([...fromContext, ...fromText].filter(Boolean))]
}

export function formatDuration(seconds) {
  const total = Math.floor(seconds)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ')
}

export function isLikelyUrl(text = '') {
  return /https?:\/\/[^\s]+/i.test(text)
}
