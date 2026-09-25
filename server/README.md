# Site Assignment API

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/me`
- `GET /api/v1/state`
- `PUT /api/v1/state`
- `GET /api/v1/state/history`
- `GET /api/v1/state/revisions/{revision}`

## Concurrency

Every state response includes a revision. Supervisors must send that revision back as `expected_revision` when saving.

If another supervisor saved first, the API returns HTTP 409 instead of losing their work.

## Authentication modes

### dev
Uses `X-User-Email` when present, otherwise `DEV_USER_EMAIL`.

### proxy
Requires the configured identity header. Use this only behind an authenticated platform/reverse proxy. The application does not treat arbitrary public headers as authentication.

## Why the first schema stores JSON

The current browser application already has a mature state shape and tested domain algorithms. Persisting that state server-side first lets us make the app multi-user without rewriting all domain logic at once.

The JSON state is a migration compatibility layer. It should be normalized into relational operational tables as the application matures.
