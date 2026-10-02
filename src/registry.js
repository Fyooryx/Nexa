export class CommandRegistry {
  constructor(commands = []) {
    this.commands = []
    this.map = new Map()
    this.registerAll(commands)
  }

  register(command) {
    validateCommand(command)

    const keys = [command.name, ...command.aliases].map(normalizeKey)
    const collisions = keys.filter(key => this.map.has(key))
    if (collisions.length) {
      throw new Error(`COMMAND_COLLISION:${collisions.join(',')}`)
    }

    this.commands.push(command)
    for (const key of keys) this.map.set(key, command)
    return command
  }

  registerAll(commands) {
    for (const command of commands) this.register(command)
    return this
  }

  get(name) {
    return this.map.get(normalizeKey(name))
  }

  categories() {
    const result = new Map()
    for (const command of this.commands) {
      if (!result.has(command.category)) result.set(command.category, [])
      result.get(command.category).push(command)
    }
    return result
  }
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase()
}

function validateCommand(command) {
  if (!command || typeof command !== 'object') throw new TypeError('command must be an object')
  if (!normalizeKey(command.name)) throw new TypeError('command name is required')
  if (!Array.isArray(command.aliases)) throw new TypeError('command aliases must be an array')
  if (typeof command.run !== 'function') throw new TypeError(`command ${command.name} must have a run function`)
  if (!normalizeKey(command.category)) throw new TypeError(`command ${command.name} category is required`)
}
