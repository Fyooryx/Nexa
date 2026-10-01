# Changelog

## 2.9.0 — Anti-flood and metadata caching

### Added
- `.antiflood on|off|status|config`
- configurable per-group flood threshold, window, and delete/warn mode
- bounded flood guard with periodic pruning
- short-lived group metadata cache wired into the Baileys socket

### Fixed
- group participant updates refresh cached metadata after membership changes
- anti-flood exemptions use PN/LID-aware admin identity checks
- warning-mode flood escalation only emits one warning per flood-window violation

### Verification
- source and test files were re-fetched after updates
- live WhatsApp end-to-end behavior remains unverified without an authenticated session
