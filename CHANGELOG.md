# Changelog

## 2.4.0 — AIO reliability and native messaging

## 2.3.0 — Kyren owner identity

### Added
- configurable `OWNER_NAME`, defaulting to `Kyren`
- `.owner` owner-card command
- owner status now displays Kyren
- owner `.listgroups` and `.leave` controls
- profile-picture lookup via `.pp`

### Fixed
- owner authorization now flows through normalized primary/alternate identity
- group-admin authorization accepts alternate sender identity
- removed stale hard-coded 2.0.0 version output

### Added
- runtime health diagnostics
- native polls
- group pin/unpin/delete tools
- owner profile name/status controls

### Fixed
- alternate owner identity now bypasses throttling correctly
- documentation and runtime version metadata are aligned at 2.4.0

### Verification
- repository files re-fetched after release commits
- core unit tests expanded for owner identity, LID matching, and command parsing
- GitHub Actions workflow configured for install + syntax + test
- live WhatsApp session was not available for end-to-end verification
