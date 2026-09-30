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
