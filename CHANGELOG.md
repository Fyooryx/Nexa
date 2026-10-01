# Changelog

## 2.8.0 — Filter capacity and management

### Added
- `.filter clear` to remove all group keyword filters
- runtime enforcement of a 100-keyword group filter limit

### Fixed
- `.filter add` can no longer grow the in-memory filter list beyond the supported capacity
- package version and documentation are synchronized at 2.8.0

### Verification
- filter unit coverage now checks the keyword capacity
- live WhatsApp end-to-end behavior remains unverified without an authenticated session
