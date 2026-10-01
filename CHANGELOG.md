# Changelog

## 2.6.0 — Runtime hardening and dynamic filter modes

### Added
- `.filter mode delete|warn` for per-group keyword moderation behavior
- migration-safe defaults for group filters and message statistics
- periodic persistence for non-command message counters
- bounded cleanup for long-running command cooldown state

### Fixed
- new or legacy group records no longer fail when message statistics are incremented
- filter/admin checks consistently use Baileys PN/LID-aware identity matching
- antilink admin detection now honors alternate sender identity
- group reset now clears keyword-filter state completely

### Verification
- unit coverage now asserts normalized group stats/filter defaults
- source files were updated on the default branch
- live WhatsApp end-to-end behavior remains unverified without an authenticated session
