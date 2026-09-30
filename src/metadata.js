import { isGroupJid, normalizeJid } from './utils.js'

export function adminSet(meta) {
  return new Set(
    (meta?.participants || [])
      .filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin')
      .map(participant => normalizeJid(participant.id))
  )
}

export function isAdmin(meta, jid) {
  return adminSet(meta).has(normalizeJid(jid))
}

export function isBotAdmin(sock, meta) {
  return isAdmin(meta, normalizeJid(sock.user?.id || ''))
}

export function describeChat(jid, meta = null) {
  return isGroupJid(jid)
    ? { type: 'group', subject: meta?.subject || 'Unknown group', jid }
    : { type: 'private', subject: null, jid }
}
