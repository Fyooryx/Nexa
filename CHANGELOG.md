# Changelog

## 2.5.0 — AIO reliability and automation upgrade

### Added
- canonical PN/LID user identity handling
- connection-aware runtime health state
- keyword group automod: `.filter on|off|add|del|list`
- group message/command statistics
- group and bot profile-picture commands
- owner block, unblock, and blocklist commands
- native polls
- group pin/unpin/delete tools

### Fixed
- command message counters no longer double-count commands
- alternate owner identity now bypasses throttling consistently
- group admin authorization accepts alternate PN/LID identity
- health no longer reports connection solely from `sock.user`
- stale v2.4 documentation replaced with v2.5 feature set

### Owner
- Nexa owner display identity: Kyren

### Verification
- core tests cover rate limiting, dedupe, persistent state, LID matching, command parsing, owner identity, health, keyword filters, and single-count statistics
- repository files re-fetched after release commits
- GitHub Actions workflow remains configured for dependency install, syntax check, and tests
- live WhatsApp end-to-end verification was not available in this environment
