# Nexa — All-in-One WhatsApp Bot

Nexa is a modular all-in-one WhatsApp bot built with Node.js and Baileys.

## Requirements

- Node.js 20+
- A WhatsApp account you are authorized to link as a companion device

## Setup

```bash
npm install
cp .env.example .env
npm start
```

On the first run, Nexa prints a QR code in the terminal. Scan it from WhatsApp → Linked devices.

The session is stored in `AUTH_DIR`. It contains cryptographic credentials and is ignored by Git.

## Pairing code

Set `PAIRING_CODE` to the phone number in digits only, including country code, for example:

```text
6281234567890
```

QR login is the baseline path. Pairing-code behavior can change upstream.

## Commands

### General

```text
.menu
.ping
.runtime
.about
.id
.time Asia/Jakarta
.calc 12*(5+2)
.afk lagi makan
.profile
```

### Group

```text
.group open
.group close
.antilink on
.antilink off
.welcome on
.welcome off
.goodbye on
.goodbye off
.tagall [message]
.kick @user
.promote @user
.demote @user
.groupinfo
```

### Media

```text
.sticker
```

Use `.sticker` with an image or by replying to an image.

### AI (optional)

Set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` in `.env`, then:

```text
.ai <prompt>
```

The module expects an OpenAI-compatible `/chat/completions` endpoint.

### Owner

```text
.status
```

## Operational notes

- Do not commit `.env`, `auth_info/`, or private runtime state.
- Group admin actions check sender and bot admin status where required.
- Nexa does not ship broadcast/bulk-message automation.
- Add new features as bounded command modules rather than widening the connection layer.

## Development

```bash
npm run check
npm run dev
```
