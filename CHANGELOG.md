# Changelog

## 3.10.0 — actionable diagnostics and multiline output

### Added
- `.diagnose` reports a context-aware next action for the current connection/authentication mode.
- Reports include the last disconnect code without exposing credentials or configured phone numbers.

### Fixed
- Corrected literal escaped newline output in health/auth/diagnostic and several multi-line command responses.

## 3.9.9 — Owner TikTok profile correction

### Fixed
- Corrected the default and sample owner TikTok handle to `zavriel.id`.

## 3.9.8 — Railway deployment configuration fix

### Fixed
- Removed the deprecated `railway.json` Config as Code file that conflicted with the current Railway configuration path.
- Keep the worker builder, Dockerfile path, health check, and restart policy in the direct Railway service configuration.
- This change alone is not proof of deployment recovery; verify Railway's latest deployment and runtime state.

## 3.9.7 — Vyrael owner profile and Railway builder configuration

### Added
- `.owner` displays the configured public WhatsApp contact, email, and TikTok profile.
- Added configurable `OWNER_EMAIL` and `OWNER_TIKTOK` settings.

### Fixed
- Default owner branding now uses Vyrael.
- Added explicit Railway config-as-code for the Dockerfile builder, persistent-worker restart policy, and `/healthz` health check to resolve conflicting builder configuration evidence.

## 3.9.6 — manual warning state and command registry

### Fixed
- Manual `.warn` retains the threshold warning count when participant removal throws or returns a non-200 response.
- Warning state resets and removal success is announced only after exactly one participant result confirms status 200.
- Removed duplicate `help` and `admins` aliases that caused command-registry construction to throw during module loading.

## 3.9.5 — fail-closed anti-flood moderation

### Fixed
- Enabled anti-flood now stops message processing when metadata or moderation actions fail.
- Flood deletion and member-removal failures are no longer silently ignored.
- Warning counts are persisted before escalation and reset only after a successful participant-removal response.
- Removal success is announced only after Baileys confirms status 200.

## 3.9.4 — fail-closed keyword moderation

### Fixed
- Message processing now stops when enabled keyword moderation fails, preventing downstream automation and command handling for that message.
- Moderation deletion errors are no longer silently ignored, and warning escalation state is not reset before deletion succeeds.

## 3.9.3 — Node 24 LTS and Docker build integrity

### Fixed
- Dockerfile now copies `package-lock.json` before running `npm ci`, restoring deterministic production image builds

### Updated
- moved Docker and CI runtime to Node.js 24 LTS
- constrained supported Node.js version to 24.x
- CI now builds the production Docker image after unit tests
- upgraded `actions/setup-node` to v7, whose runtime uses Node.js 24
- upgraded the dependency-review workflow's `actions/checkout` to v7.0.1

## 3.9.2 — Dependency maintenance

### Updated
- `dotenv` 18.0.5
- `pino` 10.4.0
- GitHub Actions checkout 7.0.1
- GitHub dependency review action 5.0.0

## 3.9.1 — Security and state hardening

### Added
- bounded media downloads with a configurable byte limit
- bounded persistent user/group state with periodic pruning
- default-deny `/metrics` unless `METRICS_TOKEN` is configured
- redacted public identity diagnostics with owner-only full identity views
- non-root Docker runtime
- pinned GitHub Actions references and read-only workflow permissions

### Fixed
- public diagnostics no longer expose raw phone/JID/LID identifiers by default
- persistent JSON state can no longer grow without an explicit configured bound
- oversized media is rejected before the full payload is buffered

### Security dependency update
- upgraded `sharp` to 0.35.5 to address high-severity inherited libvips/libheif/librsvg vulnerabilities


## 3.9.0 — Operational hardening

### Added
- optional bearer authentication for `/metrics`
- regression coverage for protected metrics access
- redacted `.env.example` without embedded owner/bot phone identifiers

### Fixed
- health launcher no longer registers duplicate SIGINT/SIGTERM shutdown handlers alongside the worker
- metrics endpoint now returns `401` with `WWW-Authenticate` when configured without valid bearer credentials

### Operations
- `/healthz` remains public liveness
- `/readyz` remains connection-aware readiness
- `/metrics` rejects unauthenticated access when `METRICS_TOKEN` is empty


## 3.8.0 — Dependency resilience

### Added
- `CircuitBreaker` primitive with closed/open/half-open lifecycle
- retry helper with exponential backoff and `Retry-After` handling
- resilient AI provider execution for transient `429` / `5xx` failures
- `.aistatus` / `.aicircuit` command for dependency state visibility
- deterministic injected-fetch tests for retry behavior

### Improved
- AI requests stop hammering a failing dependency after repeated failures
- aborted requests are not retried after the configured signal has expired


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
