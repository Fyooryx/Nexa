# Nexa — All-in-One WhatsApp Bot

**Current version: 2.5.0**  
**Owner: Kyren**

Nexa is a modular AIO WhatsApp bot built with Node.js + Baileys.

## 2.5 upgrade

- canonical PN/LID identity key for users, cooldowns, and stats
- real connection-aware health state
- keyword automod with per-group filter list
- per-group message and command statistics
- group avatar update
- bot avatar update
- owner block / unblock / blocklist tools
- native WhatsApp poll support
- pin / unpin / quoted-message delete tools
- customizable welcome/goodbye templates
- join-request approval/rejection and member-add controls
- group config inspection/reset
- LID-aware group admin authorization
- persistent JSON state normalization
- duplicate-message suppression and command throttling
- deterministic core unit tests + GitHub Actions verification

## Requirements

- Node.js 20+
- A WhatsApp account you are authorized to link as a companion device

## Setup

```bash
npm install
cp .env.example .env
npm start
```

On first run, Nexa prints a QR code in the terminal. Scan it from WhatsApp → Linked devices.

### Pairing code

Set `PAIRING_CODE` to digits only with country code:

```text
6281234567890
```

QR login remains the baseline path. Pairing-code behavior may change with upstream Baileys releases.

## Commands

### General

```text
.menu
.help ping
.ping
.runtime
.about
.owner
.health
.id
.time Asia/Jakarta
.calc 12*(5+2)
```

### Utility / Fun

```text
.base64 encode <text>
.base64 decode <base64>
.hash <text>
.poll Judul | Opsi 1 | Opsi 2
.react 👍
.coin
.dice
.chatstats
.pp [@user]
```

### User / AI

```text
.afk [reason]
.profile
.ai <prompt>
.aiclear
```

### Group

```text
.group open
.group close
.lock
.unlock
.ephemeral off|24h|7d|90d
.setprefix !
.groupconfig
.resetgroup

.welcome on|off
.setwelcome Selamat datang @user!
.goodbye on|off
.setgoodbye Sampai jumpa @user!

.filter on|off
.filter add <keyword>
.filter del <keyword>
.filter list

.disable ping
.enable ping
.disabled

.tagall [message]
.tagadmin
.admins
.groupinfo
.whois @user

.subject <name>
.desc <text>
.setgrouppp
.requests
.approve <jid>
.reject <jid>
.addmode admin_add|all_member_add
.joinapproval on|off
.invite
.revoke

.pin
.unpin
.delete
```

### Moderation

```text
.kick @user
.promote @user
.demote @user
.warn @user [reason]
.warnings [@user]
.resetwarn @user
```

### Media

```text
.sticker
.toimg
```

Use the image/sticker as the current or quoted message where required.

### Owner

```text
.status
.memory
.listgroups
.leave
.setpp
.setname <name>
.setabout <text>
.block @user
.unblock @user
.blocklist
```

## Configuration

Copy `.env.example` to `.env`.

Important settings:

- `BOT_NAME`: bot display name
- `OWNER_NAME`: owner display name; defaults to `Kyren`
- `OWNER_NUMBER`: owner number, digits only
- `PREFIX`: global command prefix
- `COMMAND_COOLDOWN_MS` / `MAX_COMMANDS_PER_WINDOW`: command throttling
- `MAX_MESSAGE_LENGTH`: input safety limit
- `WARN_LIMIT`: warning threshold
- `AI_*`: optional OpenAI-compatible AI backend

## Security / operations

- Never commit `.env`, `auth_info/`, or runtime data.
- Group administrative actions require appropriate group admin and bot admin privileges where WhatsApp requires them.
- Nexa does not include broadcast/bulk-message automation.
- Per-group command disabling does not replace authorization checks.
- AI memory can be cleared with `.aiclear`.
- Runtime status is reported from observed connection state, not from the existence of a socket object.
- A tool receipt or successful commit is not treated as proof of an external WhatsApp outcome.

## Development

```bash
npm run check
npm test
npm run dev
```

## Project layout

```text
src/
├── commands.js
├── config.js
├── filters.js
├── health.js
├── index.js
├── limits.js
├── metadata.js
├── runtime.js
├── store.js
└── utils.js
test/
└── core.test.js
.github/
└── workflows/
    └── check.yml
package.json
README.md
CHANGELOG.md
```

Nexa is not affiliated with or endorsed by WhatsApp.
