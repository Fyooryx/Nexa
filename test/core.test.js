import test from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter, MessageDeduper } from '../src/limits.js'
import { FloodGuard } from '../src/flood.js'
import { JsonStore } from '../src/store.js'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

test('FloodGuard trips after the configured threshold', () => {
  const guard = new FloodGuard({ maxKeys: 20 })
  assert.equal(guard.hit('g:u', { windowMs: 1000, max: 2 }).limited, false)
  assert.equal(guard.hit('g:u', { windowMs: 1000, max: 2 }).limited, false)
  assert.equal(guard.hit('g:u', { windowMs: 1000, max: 2 }).firstViolation, true)
  assert.equal(guard.hit('g:u', { windowMs: 1000, max: 2 }).firstViolation, false)
})

test('RateLimiter blocks after max calls inside window', () => {
  const limiter = new RateLimiter({ intervalMs: 1000, max: 2 })
  assert.equal(limiter.allow('u'), true)
  assert.equal(limiter.allow('u'), true)
  assert.equal(limiter.allow('u'), false)
})

test('MessageDeduper detects repeated ids', () => {
  const deduper = new MessageDeduper(2)
  assert.equal(deduper.seen('a'), false)
  assert.equal(deduper.seen('a'), true)
  assert.equal(deduper.seen('b'), false)
  assert.equal(deduper.seen('c'), false)
  assert.equal(deduper.seen('a'), false)
})

test('JsonStore initializes and persists normalized group state', async () => {
  const dir = await import('node:fs/promises').then(m => m.mkdtemp(path.join(os.tmpdir(), 'nexa-test-')))
  try {
    const store = new JsonStore(dir)
    await store.init()
    const group = store.group('123@g.us')
    group.welcome = true
    group.welcomeText = 'Welcome @user'
    store.addWarn('123@g.us', '456@s.whatsapp.net', 'test')
    await store.persist()

    const second = new JsonStore(dir)
    await second.init()
    assert.equal(second.group('123@g.us').welcome, true)
    assert.equal(second.group('123@g.us').welcomeText, 'Welcome @user')
    assert.equal(second.warnCount('123@g.us', '456@s.whatsapp.net'), 1)
    assert.deepEqual(second.group('123@g.us').stats, { messages: 0, commands: 0 })
    assert.equal(second.group('123@g.us').filterEnabled, false)
    assert.equal(second.group('123@g.us').filterMode, 'delete')
    assert.deepEqual(second.group('123@g.us').filters, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

import { participantMatches, adminSet } from '../src/metadata.js'
import { parseCommand, targetFromContext } from '../src/utils.js'

test('LID-aware participant matching recognizes id, phoneNumber and lid', () => {
  const participant = {
    id: '12345@lid',
    phoneNumber: '628123456789@s.whatsapp.net',
    lid: '12345@lid',
    admin: 'admin'
  }
  assert.equal(participantMatches(participant, '12345@lid'), true)
  assert.equal(participantMatches(participant, '628123456789@s.whatsapp.net'), true)
  assert.equal(adminSet({ participants: [participant] }).has('12345@lid'), true)
})

test('parseCommand honors per-chat prefix', () => {
  assert.deepEqual(parseCommand('!ping now', '!'), {
    name: 'ping',
    args: ['now']
  })
  assert.equal(parseCommand('.ping', '!'), null)
})

test('targetFromContext accepts quoted participant fallback', () => {
  const message = {
    extendedTextMessage: {
      contextInfo: {
        stanzaId: 'ABC',
        participant: '999@s.whatsapp.net',
        quotedMessage: { conversation: 'hello' }
      }
    }
  }
  assert.equal(targetFromContext(message, 'remove'), '999@s.whatsapp.net')
})

import { config } from '../src/config.js'

test('Nexa owner identity and pairing number defaults are explicit', () => {
  assert.equal(config.ownerName, 'Kyren')
  assert.equal(config.botVersion, '3.2.0')
  assert.equal(config.pairingNumber, '')
})

import { healthSnapshot, formatHealth } from '../src/health.js'

test('health snapshot exposes Kyren owner and runtime counters', () => {
  const snapshot = healthSnapshot({
    sock: { user: { id: 'bot@s.whatsapp.net' } },
    store: { data: { groups: { 'g@g.us': {} }, users: { 'u@s.whatsapp.net': {} }, meta: { messages: 4, commands: 2 } } },
    config: { botName: 'Nexa', botVersion: '3.1.1', ownerName: 'Kyren' },
    runtimeState: { connection: 'open', connectedAt: 1, lastDisconnectedAt: null, lastDisconnectCode: null, reconnects: 0 }
  })
  assert.equal(snapshot.owner, 'Kyren')
  assert.equal(snapshot.connected, true)
  assert.equal(snapshot.counters.messages, 4)
  assert.match(formatHealth(snapshot), /Owner: Kyren/)
})

import { addKeyword, findMatchedKeyword, removeKeyword } from '../src/filters.js'

test('keyword filter add/remove/match lifecycle', () => {
  const group = { filters: [] }
  assert.equal(addKeyword(group, 'Scam'), true)
  assert.equal(addKeyword(group, 'scam'), false)
  assert.equal(findMatchedKeyword('Ini SCAM sekarang', group), 'scam')
  assert.equal(removeKeyword(group, 'SCAM'), true)
  assert.equal(findMatchedKeyword('Ini SCAM sekarang', group), null)
  for (let i = 0; i < 100; i++) assert.equal(addKeyword(group, `word-${i}`), true)
  assert.equal(addKeyword(group, 'overflow-a'), false)
})

test('JsonStore counts a command once, not twice', async () => {
  const dir = await import('node:fs/promises').then(m => m.mkdtemp(path.join(os.tmpdir(), 'nexa-counter-')))
  try {
    const store = new JsonStore(dir)
    await store.init()
    store.bumpMessage({ jid: '123@g.us', sender: '456@s.whatsapp.net', isCommand: true })
    assert.equal(store.data.meta.messages, 1)
    assert.equal(store.data.meta.commands, 1)
    assert.equal(store.group('123@g.us').stats.messages, 1)
    assert.equal(store.group('123@g.us').stats.commands, 1)
    assert.equal(store.user('456@s.whatsapp.net').messages, 1)

    const participant = {
      id: '12345@lid',
      phoneNumber: '628123456789@s.whatsapp.net',
      lid: '12345@lid'
    }
    assert.equal(store.canonicalParticipant({ participants: [participant] }, '12345@lid'), '628123456789@s.whatsapp.net')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

import { readFile } from 'node:fs/promises'

test('commands defines resolveTarget helper and self-state uses canonical userKey', async () => {
  const source = await readFile(new URL('../src/commands.js', import.meta.url), 'utf8')
  assert.match(source, /async function resolveTarget\(ctx, meta\)/)
  assert.doesNotMatch(source, /ctx\.store\.user\(ctx\.sender\)\.afk/)
  assert.doesNotMatch(source, /const user = ctx\.store\.user\(ctx\.sender\)/)
})
