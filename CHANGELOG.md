# Changelog

## 2.7.0 — Graceful shutdown and moderation escalation

### Added
- final state flush during SIGINT/SIGTERM shutdown
- filter-mode warning escalation when `WARN_LIMIT` is reached
- safe shutdown de-duplication so repeated signals do not race multiple flushes

### Fixed
- runtime no longer exits before attempting the final JSON persistence
- keyword filter `warn` mode now follows the configured warning threshold
- filter escalation uses the same PN/LID-aware identity checks

### Verification
- source files were re-fetched after update commits
- live WhatsApp end-to-end behavior remains unverified without an authenticated session
