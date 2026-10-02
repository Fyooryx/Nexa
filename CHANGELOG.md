# Changelog

## 3.7.0 — Contract and security hardening

### Added
- fail-fast `CommandRegistry` abstraction for command registration and lookup
- startup validation for command name, aliases, category, and handler contract
- regression coverage for alias collision detection
- event-loop maximum latency Prometheus metric

### Fixed
- `.authstatus` now uses redacted bot identity output
- HTTP health server now returns bodyless responses for `HEAD`
- malformed request URLs return a controlled `400` response instead of escaping the request handler
- readiness telemetry uses a direct `nexa_ready` gauge instead of a misleading per-state zero/one series

### Operations
- command registration now fails closed instead of silently overwriting a previous alias


## 3.6.0 — Runtime telemetry

### Added
- Node.js event-loop delay telemetry with low-overhead native `perf_hooks` monitoring
- Prometheus-compatible `/metrics` endpoint
- runtime memory metrics for RSS, V8 heap, external buffers, and ArrayBuffers
- event-loop mean, p95, and maximum latency metrics
- health server GET/HEAD method contract

### Improved
- dedicated health launcher now starts telemetry before the WhatsApp worker
- liveness remains independent from WhatsApp readiness, allowing hosted probes during boot/reconnect
- telemetry lifecycle is explicitly stopped during process shutdown


## 3.5.0 — Resilience and observability

### Added
- lightweight HTTP liveness endpoint at /healthz
- connection-aware readiness endpoint at /readyz
- minimal root service endpoint at /
- dedicated src/server.js launcher so hosted workers can expose a runtime probe without changing the Baileys worker flow
- HEALTH_HOST / HEALTH_PORT configuration, with hosted PORT taking precedence
- regression coverage for health endpoint status behavior

### Fixed
- health output now includes authentication mode, reconnect count, and metadata-cache size
- JSON store writes now recover after a rejected queued write instead of permanently poisoning the write chain
- JSON serialization happens when each queued write actually starts, keeping the persisted snapshot aligned with the latest in-memory state

### Operations
- Nexa worker remains a single persistent process with file-based auth/data storage
- /healthz is intended for process-level liveness checks; /readyz reflects actual WhatsApp runtime readiness
- live WhatsApp E2E remains a separate verification step after deployment

## 3.4.0 — Deployment architecture

### Added
- production Dockerfile for the persistent Nexa worker
- Docker build exclusions for .env, auth_info/, and data/
- docs/deployment.md covering Vercel, Netlify, Supabase, Render, Railway, and VPS roles

### Architecture
- keep the live Baileys socket on a persistent Node.js worker
- use Vercel/Netlify for optional HTTP control-plane components
- use Supabase for persistent database/services around the worker
- Nexa version bumped to 3.4.0


## 3.3.1 — Owner and bot identity configuration

### Changed
- configure the provided WhatsApp number as OWNER_NUMBER
- configure the same number as PAIRING_NUMBER for pairing-code mode
- Nexa version bumped to 3.3.1


## 3.3.0 — Diagnostics and cache maintenance

### Added
- diagnose / diag safe runtime and setup diagnostic command
- auth mode and metadata-cache visibility in health output

### Improved
- expired group metadata cache entries are periodically pruned
- Nexa version bumped to 3.3.0

### Security
- .diagnose reports only whether PAIRING_NUMBER is configured; it does not print the number
- .diagnose redacts phone-based bot identity instead of exposing a raw JID


## 3.2.0 — QR fallback and identity hardening

### Fixed
- remove duplicated anti-flood group normalization fields
- correct FloodGuard.firstViolation regression coverage
- unify AI and chat statistics on the canonical PN/LID user key
- make .warnings safely resolve the current sender when no target is supplied

### Added
- authstatus diagnostic command for QR/pairing/saved-session visibility
- explicit startup messaging for QR mode when PAIRING_NUMBER is empty
- secure .env.example default with no personal-looking owner number
- canonical participant regression coverage
- Nexa version bumped to 3.2.0

### Authentication note
- empty PAIRING_NUMBER means QR mode, not a number-less WhatsApp bot
- Nexa still needs an authorized WhatsApp account to scan the QR or complete pairing
- saved authentication sessions continue to start without re-pairing

### Verification
- repository source and tests updated
- live WhatsApp E2E remains unverified without an authenticated session
