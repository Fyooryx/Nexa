# Nexa deployment architecture

Nexa has two workloads: a long-lived WhatsApp worker and optional request-oriented control-plane components.

## Platform fit

| Platform | Long-lived Nexa worker | Good role |
| --- | --- | --- |
| Vercel | No: use as control plane, not the permanent Baileys process | dashboard, API, webhooks |
| Netlify | No: use as control plane, not the permanent Baileys process | dashboard, API, webhooks |
| Supabase | No: Edge Functions are bounded; use the database/services around the worker | Postgres, Auth, Storage, Edge Functions |
| Render | Yes | background worker / Docker worker |
| Railway | Yes | persistent service / Docker worker |
| VPS | Yes | full runtime control |

Vercel supports WebSockets and long-running Functions, but Function execution remains bounded. Netlify Background Functions are also bounded. Supabase Edge Functions have wall-clock and CPU limits. The Nexa Baileys session should therefore live on a persistent worker.

## Current Nexa storage model

- AUTH_DIR stores Baileys authentication state.
- DATA_DIR stores Nexa JSON state.
- Both locations must survive process/container restarts.

Do not bake auth_info/, data/, or .env into the container image.

## Docker

Build:

    docker build -t nexa .

Run:

    docker run --rm -it --env-file .env -v nexa-auth:/app/auth_info -v nexa-data:/app/data nexa

QR mode uses an empty PAIRING_NUMBER. Pairing-code mode uses the bot account number in PAIRING_NUMBER.

## Render

Use a Background Worker or Docker-based worker. Attach persistent storage for auth_info/ and data/. Keep one active worker while Nexa uses file-based state; multiple replicas writing the same JSON state are not a safe topology.

## Railway

Use a persistent Service, optionally built from the Dockerfile. Keep one active worker while Nexa uses file-based state and attach persistent storage for auth_info/ and data/.

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