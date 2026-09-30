# Nexa — All-in-One WhatsApp Bot

Nexa is a modular AIO WhatsApp bot built with Node.js + Baileys.

## 2.0 upgrade

- hardened reconnect lifecycle with exponential backoff
- Baileys browser tuple set to macOS/Chrome for current v7 RC connection compatibility
- bounded command rate limiting + duplicate-message suppression
- per-group custom prefix
- per-group command disable/enable filter
- group welcome/goodbye + anti-link
- group admin tools: tagall, tagadmin, kick, promote, demote, warn, warnings, resetwarn
- group controls: open/close, subject, description, invite, revoke
- media pipeline: image → sticker and sticker → PNG
- utility tools: time, calc, Base64, SHA-256, reaction
- AI module with bounded local memory + `.aiclear`
- owner status + memory diagnostics
- persistent JSON state with migration/default normalization
- GitHub Actions syntax validation

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
.id
.time Asia/Jakarta
.calc 12*(5+2)
```

### Utility / Fun
```text
.base64 encode <text>
.base64 decode <base64>
.hash <text>
.react <emoji>
.coin
.dice
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
.setprefix !
.disable ping
.enable ping
.disabled
.antilink on
.welcome on
.goodbye on
.tagall [message]
.tagadmin
.groupinfo
.admins
.subject <name>
.desc <text>
.invite
.revoke
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
Use the image/sticker as the current or quoted message:
```text
.sticker
.toimg
```

### Owner
```text
.status
.memory
```

## Configuration

Copy `.env.example` to `.env`.

Important settings:
- `OWNER_NUMBER`: owner number, digits only
- `PREFIX`: default command prefix
- `COMMAND_COOLDOWN_MS` and `MAX_COMMANDS_PER_WINDOW`: command throttling
- `WARN_LIMIT`: warning display limit
- `AI_*`: optional OpenAI-compatible AI backend

## Security / operations

- Never commit `.env`, `auth_info/`, or runtime data.
- Group administrative actions require appropriate group admin privileges and bot admin privileges where WhatsApp requires them.
- Nexa does not include broadcast/bulk-message automation.
- Disable/enable controls are scoped to each group.
- AI memory can be cleared by the user with `.aiclear`.
- A command being disabled is not an authorization mechanism; privileged commands still enforce their own checks.
- A tool response is not treated as proof of successful external state. Commands report only what Nexa actually observes.

## Development

```bash
npm run check
npm run dev
```

## Project layout

```text
src/
├── commands.js
├── config.js
├── index.js
├── limits.js
├── metadata.js
├── store.js
└── utils.js
.github/
└── workflows/
    └── check.yml
```

Nexa is not affiliated with or endorsed by WhatsApp.