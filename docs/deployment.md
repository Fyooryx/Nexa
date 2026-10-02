# Nexa deployment architecture

Nexa has two workloads: a long-lived WhatsApp worker and a small request-oriented health/control surface.

## Platform fit

| Platform | Long-lived Nexa worker | Good role |
| --- | --- | --- |
| Vercel | No: use as control plane, not the permanent Baileys process | dashboard, API, webhooks |
| Netlify | No: use as control plane, not the permanent Baileys process | dashboard, API, webhooks |
| Supabase | No: Edge Functions are bounded; use the database/services around the worker | Postgres, Auth, Storage, Edge Functions |
| Render | Yes | background worker / Docker worker |
| Railway | Yes | persistent service / Docker worker |
| VPS | Yes | full runtime control |

The Baileys session remains a long-lived worker. The HTTP surface added in 3.5.0 is only for process liveness/readiness and does not replace the WhatsApp socket.

## Current Nexa storage model

- AUTH_DIR stores Baileys authentication state.
- DATA_DIR stores Nexa JSON state.
- For Railway, both paths are placed under /app/runtime so a single service volume can persist both.
- Both locations must survive process/container restarts.

Do not bake auth_info/, data/, or .env into the container image.

## Runtime health endpoints

The default launcher is now node src/server.js. It starts the Nexa worker and a small HTTP server.

- GET /healthz → 200 while the process is alive.
- GET /readyz → 200 only when the WhatsApp runtime state is open; otherwise 503.
- GET / → minimal service/version/connection JSON.

HEALTH_HOST defaults to 0.0.0.0. HEALTH_PORT defaults to 3000, while an injected PORT takes precedence for hosted platforms.

These endpoints intentionally expose no configured owner number, auth credentials, message contents, group lists, or stored user data.

## Docker

Build:

    docker build -t nexa .

Run:

    docker run --rm -it --env-file .env -v nexa-runtime:/app/runtime nexa

QR mode uses an empty PAIRING_NUMBER. Pairing-code mode uses the bot account number in PAIRING_NUMBER.

## Render

Use a Background Worker or Docker-based worker. Attach one persistent volume covering /app/runtime (which contains auth_info/ and data/). Keep one active worker while Nexa uses file-based state; multiple replicas writing the same JSON state are not a safe topology.

## Railway

Use a persistent Service, optionally built from the Dockerfile. Keep one active worker while Nexa uses file-based state and attach persistent storage for auth_info/ and data/.

For health checks, point the service at /healthz for process liveness. Use /readyz only when the platform should distinguish a live process from a connected WhatsApp session.

## Vercel

Do not deploy npm start as the permanent Nexa process. Use Vercel for a future dashboard, API, or webhook/control layer, while the Baileys worker runs on Render, Railway, or another persistent host.

## Netlify

Use Netlify for a future dashboard, static frontend, webhook receiver, or request-oriented function. Do not treat a Background Function as a permanent Baileys worker.

## Supabase

Supabase is suitable for Postgres-backed persistent state, Auth, Storage, and short-lived Edge Functions around Nexa. A future storage adapter can replace the current JSON store with Postgres without moving the live Baileys socket into Edge Functions.

## Target topology

    WhatsApp -> Nexa persistent worker -> Supabase Postgres
                           ^
                           | HTTPS
                    Vercel / Netlify
                    dashboard / API

Only the persistent worker should own the live Baileys socket.

## Operational rules

- Keep auth_info/ private.
- Keep .env private.
- Use one worker instance with the current file-based store.
- Persist runtime storage across restarts.
- Keep graceful shutdown enabled.
- Verify the actual WhatsApp session after deployment; a successful deploy is not proof of WhatsApp E2E connectivity.
