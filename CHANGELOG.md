# Changelog

## 3.0.0 — Target resolution and unified user state

### Fixed
- restored the missing `resolveTarget(ctx, meta)` runtime helper used by moderation and profile-picture commands
- moderation warning state now canonicalizes group participants to phone identity when available
- AFK, profile, AI, and AI-reset self state use `ctx.userKey` consistently

### Added
- `JsonStore.canonicalParticipant()` helper for PN/LID-aware target state

### Verification
- source files and tests were re-fetched after update commits
- live WhatsApp end-to-end behavior remains unverified without an authenticated session
