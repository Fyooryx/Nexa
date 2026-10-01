# Nexa — All-in-One WhatsApp Bot

**Current version: 3.2.0**  
**Owner: Kyren**

Nexa is a modular AIO WhatsApp bot built with Node.js + Baileys.

## 3.1 upgrade

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
- persistent JSON state normalization with migration-safe filter/stat defaults
- periodic state flushing for non-command message counters
- bounded cleanup for long-running command cooldown state
- graceful shutdown with final state flush
- warning-mode filter escalation at `WARN_LIMIT`
- per-group anti-flood protection with configurable threshold/window/mode
- TTL group metadata cache for lower repeated metadata traffic
- fixed missing target-resolution helper used by moderation/media commands
- canonical PN/LID identity for AFK and AI self state
- explicit `PAIRING_NUMBER` setup for the bot account
- `start.sh` launcher for Linux/Termux
- `.botid` for checking the connected bot identity
- repaired group metadata cache helper
- explicit QR fallback when `PAIRING_NUMBER` is empty
- canonical PN/LID user identity for AI and chat statistics
- safer `.warnings` self-target behavior
- duplicate-message suppression and command throttling
- deterministic core unit tests + GitHub Actions verification

## Requirements

- Node.js 20+
- A WhatsApp account you are authorized to link as a companion device

## Setup

Install and prepare the environment:

```bash
npm install
cp .env.example .env
```

Edit `.env` before starting:

```text
BOT_NAME=Nexa
OWNER_NAME=Kyren
OWNER_NUMBER=628xxxxxxxxxx
PAIRING_NUMBER=628xxxxxxxxxx
```

`PAIRING_NUMBER` is optional. When set, it is the **WhatsApp phone number of the account that will become Nexa** and Nexa uses pairing-code authentication. When empty, Nexa uses QR authentication instead. `OWNER_NUMBER` is the phone number allowed to use owner-only commands. They can be the same account, but they represent different roles in the configuration.

### Start with bot number + pairing code

Baileys expects the pairing phone number with country code and digits only: no `+`, spaces, parentheses, or hyphens. Nexa passes `PAIRING_NUMBER` to `requestPairingCode()`. citeturn296093search1turn296093search3

```bash
npm start
```

For Linux/Termux, the same startup is also available through:

```bash
bash start.sh
```

On the first connection, Nexa prints a **pairing code** in the terminal. On the WhatsApp phone that owns `PAIRING_NUMBER`, open **Linked Devices → Link a Device → Link with phone number instead**, then enter the generated code. citeturn296093search3

After pairing succeeds, the session is stored under `AUTH_DIR`; subsequent starts reuse the saved credentials instead of requiring a fresh pairing each time. citeturn296093search3

### Start with QR — no number in `.env`

You do **not** need to type the bot number into `.env` when using QR mode. Leave `PAIRING_NUMBER` empty:

```text
PAIRING_NUMBER=
```

Then run:

```bash
npm start
```

Nexa will display a QR code in the terminal. Scan it from WhatsApp → Linked Devices. The WhatsApp account that completes the link becomes the Nexa account.

**Important:** empty `PAIRING_NUMBER` does not mean Nexa can run without a WhatsApp account or phone number. It only means the number is supplied implicitly by the account that scans the QR code.

### Put the bot into a group

Once the WhatsApp account is linked, that **WhatsApp account becomes the Nexa bot account**. In pairing-code mode, its number is the value in `PAIRING_NUMBER`; in QR mode, the number is supplied by the account that scans the QR. Use `.botid` to inspect the connected identity before adding Nexa to a group.

The practical order is:

```text
1. Link the bot account.
2. Open the target group from another member/admin account.
3. Add the bot's WhatsApp number to the group.
4. Make the bot an admin if you want moderation/group-management features.
5. Send .menu in the group to confirm Nexa is responding.
```

Features such as kicking members, deleting filtered messages, changing group settings, pinning, and similar administrative actions require Nexa to have the appropriate group permissions.

Use this command after the bot is connected to inspect its active identity:

```text
.botid
```

`PAIRING_CODE` is still accepted as a legacy environment-variable fallback for existing deployments, but new deployments should use `PAIRING_NUMBER`.

Use `.authstatus` after connection to inspect whether Nexa is using QR, pairing code, or a saved session.

## Commands

### General

```text
.botid
.authstatus
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
.filter mode delete|warn
.filter add <keyword>
.filter del <keyword>
.filter list
.filter clear

.antiflood on|off
.antiflood status
.antiflood config <3-20> <3-60s> delete|warn

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
- `STORE_FLUSH_MS`: periodic state flush interval (5s–120s)
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
