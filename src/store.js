import fs from 'node:fs/promises'
import path from 'node:path'

const defaults = {
  groups: {},
  users: {},
  meta: { version: 2, messages: 0, commands: 0, startedAt: Date.now() }
}

function normalizeGroup(value) {
  return {
    prefix: typeof value?.prefix === 'string' && value.prefix.length <= 3 ? value.prefix : null,
    antilink: Boolean(value?.antilink),
    welcome: Boolean(value?.welcome),
    goodbye: Boolean(value?.goodbye),
    welcomeText: typeof value?.welcomeText === 'string' ? value.welcomeText.slice(0, 500) : '👋 Selamat datang @user di grup!',
    goodbyeText: typeof value?.goodbyeText === 'string' ? value.goodbyeText.slice(0, 500) : '👋 @user keluar dari grup.',
    disabledCommands: Array.isArray(value?.disabledCommands) ? [...new Set(value.disabledCommands)] : [],
    filters: Array.isArray(value?.filters)
      ? [...new Set(value.filters.filter(item => typeof item === 'string').map(item => item.trim().toLocaleLowerCase('id-ID')).filter(Boolean))].slice(0, 100)
      : [],
    filterEnabled: Boolean(value?.filterEnabled),
    filterMode: value?.filterMode === 'warn' ? 'warn' : 'delete',
    antiflood: Boolean(value?.antiflood),
    floodMax: Math.min(20, Math.max(3, Number(value?.floodMax || 6))),
    floodWindowMs: Math.min(60000, Math.max(3000, Number(value?.floodWindowMs || 5000))),
    floodMode: value?.floodMode === 'warn' ? 'warn' : 'delete',
    warns: value?.warns && typeof value.warns === 'object' ? value.warns : {},
    stats: {
      messages: Number(value?.stats?.messages || 0),
      commands: Number(value?.stats?.commands || 0)
    }
  }
}

export class JsonStore {
  constructor(dir) {
    this.dir = dir
    this.file = path.join(dir, 'nexa.json')
    this.data = structuredClone(defaults)
    this.writeChain = Promise.resolve()
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true })
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw)
      this.data = { ...structuredClone(defaults), ...parsed }
      this.data.groups = Object.fromEntries(
        Object.entries(this.data.groups || {}).map(([jid, value]) => [jid, normalizeGroup(value)])
      )
      this.data.users ??= {}
      this.data.meta = { ...structuredClone(defaults.meta), ...(this.data.meta || {}) }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await this.persist()
    }
  }

  async persist() {
    const payload = JSON.stringify(this.data, null, 2)
    this.writeChain = this.writeChain.then(async () => {
      const temp = `${this.file}.tmp`
      await fs.writeFile(temp, payload, 'utf8')
      await fs.rename(temp, this.file)
    })
    return this.writeChain
  }

  group(jid) {
    if (!this.data.groups[jid]) this.data.groups[jid] = normalizeGroup({})
    return this.data.groups[jid]
  }

  user(jid) {
    this.data.users[jid] ??= { afk: null, messages: 0 }
    this.data.users[jid].warnings ??= {}
    this.data.users[jid].aiHistory ??= []
    this.data.users[jid].messages = Number(this.data.users[jid].messages || 0)
    return this.data.users[jid]
  }

  canonicalUser(preferred, alternate = null) {
    const values = [preferred, alternate].filter(Boolean)
    return values.find(value => value.endsWith('@s.whatsapp.net')) || values[0] || ''
  }

  groupPrefix(jid, globalPrefix) {
    return this.group(jid).prefix || globalPrefix
  }

  isCommandDisabled(jid, name) {
    return this.group(jid).disabledCommands.includes(name.toLowerCase())
  }

  setCommandDisabled(jid, name, disabled) {
    const group = this.group(jid)
    const normalized = name.toLowerCase()
    const set = new Set(group.disabledCommands)
    disabled ? set.add(normalized) : set.delete(normalized)
    group.disabledCommands = [...set].sort()
  }

  warnCount(jid, target) {
    return Number(this.group(jid).warns[target]?.count || 0)
  }

  addWarn(jid, target, reason) {
    const group = this.group(jid)
    const entry = group.warns[target] || { count: 0, items: [] }
    entry.count += 1
    entry.items.push({ at: Date.now(), reason: reason || 'tanpa alasan' })
    entry.items = entry.items.slice(-10)
    group.warns[target] = entry
    return entry.count
  }

  resetWarn(jid, target) {
    delete this.group(jid).warns[target]
  }

  bumpMessage({ jid = null, sender = null, isCommand = false } = {}) {
    this.data.meta.messages = Number(this.data.meta.messages || 0) + 1
    if (isCommand) this.data.meta.commands = Number(this.data.meta.commands || 0) + 1

    if (sender) {
      const user = this.user(sender)
      user.messages += 1
    }

    if (jid?.endsWith('@g.us')) {
      const group = this.group(jid)
      group.stats.messages += 1
      if (isCommand) group.stats.commands += 1
    }
  }
}
