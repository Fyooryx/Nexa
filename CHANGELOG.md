# Changelog

## 3.2.0 — QR fallback and identity hardening

### Fixed
- remove duplicated anti-flood group normalization fields
- correct `FloodGuard.firstViolation` regression coverage
- unify AI and chat statistics on the canonical PN/LID user key
- make `.warnings` safely resolve the current sender when no target is supplied

### Added
- `authstatus` diagnostic command for QR/pairing/saved-session visibility
- explicit startup messaging for QR mode when `PAIRING_NUMBER` is empty
- secure `.env.example` default with no personal-looking owner number
- canonical participant regression coverage
- Nexa version bumped to 3.2.0

### Authentication note
- empty `PAIRING_NUMBER` means **QR mode**, not a number-less WhatsApp bot
- Nexa still needs an authorized WhatsApp account to scan the QR or complete pairing
- saved authentication sessions continue to start without re-pairing

### Verification
- repository source and tests updated
- live WhatsApp E2E remains unverified without an authenticated session
