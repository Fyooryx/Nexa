import fs from 'node:fs/promises'
import path from 'node:path'

const defaults = {
  groups: {},
  users: {},
  meta: { version: 1 }
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
      this.data = { ...structuredClone(defaults), ...JSON.parse(raw) }
      this.data.groups ??= {}
      this.data.users ??= {}
      this.data.meta ??= { version: 1 }
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
    this.data.groups[jid] ??= {
      antilink: false,
      welcome: false,
      goodbye: false
    }
    return this.data.groups[jid]
  }

  user(jid) {
    this.data.users[jid] ??= { afk: null }
    return this.data.users[jid]
  }
}
