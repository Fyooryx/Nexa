import test from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter, MessageDeduper } from '../src/limits.js'
import { JsonStore } from '../src/store.js'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

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

test('Nexa owner identity defaults to Kyren', () => {
  assert.equal(config.ownerName, 'Kyren')
})
