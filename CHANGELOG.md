# Changelog

## 3.1.1 — Pairing and group-cache hardening

### Fixed
- pairing flow consistently uses `PAIRING_NUMBER` when requesting the pairing code
- group participant events refresh the local metadata cache

### Added
- `start.sh` launcher for Linux/Termux

### Verification
- repository files were re-fetched after the release patch
- live WhatsApp pairing and group E2E remain unverified without an authenticated session
