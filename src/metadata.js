import { isGroupJid, normalizeJid } from './utils.js'

export function participantJids(participant) {
  return [
    participant?.id,
    participant?.phoneNumber,
    participant?.lid
  ].filter(Boolean).map(normalizeJid)
}

export function participantMatches(participant, jid, sock = null) {
  const target = normalizeJid(jid)
  const candidates = participantJids(participant)
  if (candidates.includes(target)) return true

  if (sock?.user?.id && target === normalizeJid(sock.user.id)) {
    return true
  }

  if (sock?.user?.lid && target === normalizeJid(sock.user.lid)) {
    return true
  }

  return false
}

export function adminParticipants(meta) {
  return (meta?.participants || []).filter(participant => (
    participant.admin === 'admin' || participant.admin === 'superadmin'
  ))
}

export function adminSet(meta) {
  return new Set(adminParticipants(meta).flatMap(participantJids))
}

export function isAdmin(meta, jid, sock = null) {
  return adminParticipants(meta).some(participant => participantMatches(participant, jid, sock))
}

export function isBotAdmin(sock, meta) {
  const me = [sock?.user?.id, sock?.user?.lid].filter(Boolean)
  return me.some(jid => isAdmin(meta, jid, sock))
}

export function isGroupOwner(meta, jid, sock = null) {
  const owner = meta?.owner
  return Boolean(owner) && participantMatches({ id: owner }, jid, sock)
}

export function describeChat(jid, meta = null) {
  return isGroupJid(jid)
    ? { type: 'group', subject: meta?.subject || 'Unknown group', jid }
    : { type: 'private', subject: null, jid }
}
