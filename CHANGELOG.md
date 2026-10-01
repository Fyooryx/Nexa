# Changelog

## 3.1.0 — Setup clarity and credential hygiene

### Added
- `PAIRING_NUMBER` as the explicit WhatsApp number used for pairing
- `.botid` to inspect the connected bot identity
- setup documentation for starting Nexa and adding the bot account to groups
- restored group metadata cache helper used by anti-flood paths

### Fixed
- `PAIRING_CODE` terminology is no longer used as the primary configuration name
- `src/flood.js` is included in the syntax-check script
- `.env.example` no longer contains a credential value

### Security
- any previously exposed API credential in repository history should be revoked/rotated; sanitizing the current example file does not erase old Git history

### Verification
- source/config/documentation files were re-fetched after updates
- live WhatsApp pairing and group E2E remain unverified without an authenticated session
