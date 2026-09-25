# Self-hosting `shifts.ramessar.io`

This deployment is designed for the existing Windows + Docker Desktop home server.

## Services

```text
Internet
   |
Cloudflare
   |
shifts.ramessar.io
   |
Cloudflare Tunnel
   |
127.0.0.1:8088
   |
shifts-web (nginx)
   |-------------------- static application
   |
   +---- /api/* -------> shifts-api (FastAPI)
                            |
                            +------> shifts-db (PostgreSQL)
                            |
                            +------> host.docker.internal:3030/v1
                                     existing Ramessar AI gateway
                                     |
                                     +--> Windows Ollama
```

Only nginx is published to the host. PostgreSQL and FastAPI are internal Docker services.

## Install

A convenient server location is:

```powershell
D:\server\shifts
```

Clone the production branch while it is under review:

```powershell
cd D:\server
git clone -b feat/production-foundation https://github.com/Cramessar/site-assignment-prototype.git shifts
cd D:\server\shifts
```

Create the environment file:

```powershell
Copy-Item .env.example .env
notepad .env
```

At minimum change:

- `POSTGRES_PASSWORD`
- `DATABASE_URL` so it contains the same URL-safe password
- `BOOTSTRAP_SUPERVISORS`
- `AI_API_KEY`

The self-host example defaults to `AUTH_MODE=proxy` with `IDENTITY_HEADER=cf-access-authenticated-user-email`. **Before publishing the hostname, put the entire `shifts.ramessar.io` application behind a Cloudflare Access policy.**

For localhost-only development, you can temporarily use:

```text
AUTH_MODE=dev
DEV_USER_EMAIL=your-email@example.com
```

Do not use dev auth on the public hostname.

The AI key should be one of the existing `rsk_*` Bearer keys from the Ramessar API gateway. Do not commit `.env`.

## Start

```powershell
.\scripts\start-shifts.ps1
```

or directly:

```powershell
docker compose up -d --build
```

Open locally:

- App: http://localhost:8088
- API docs through nginx: http://localhost:8088/api/docs
- Health: http://localhost:8088/healthz

## Cloudflare Tunnel

First create a **Cloudflare Access application/policy** for `shifts.ramessar.io` so only approved users can reach the site. Then configure the Tunnel public hostname.

If `cloudflared` runs directly on the Windows host, create a public hostname:

```text
Hostname: shifts.ramessar.io
Service:  http://localhost:8088
```

If your Cloudflare Tunnel is itself a Docker container, either:

1. route it to the Windows host using `http://host.docker.internal:8088`, or
2. attach that tunnel container to the `shifts-internal` network and route directly to `http://shifts-web:80`.

Do not expose PostgreSQL to Cloudflare or the LAN.

## Local AI

The application backend talks to the existing OpenAI-compatible gateway:

```text
AI_BASE_URL=http://host.docker.internal:3030/v1
AI_MODEL=auto
```

Available API endpoints:

- `GET /api/v1/ai/models`
- `POST /api/v1/ai/assist`

The AI assistant is advisory only. Deterministic scheduling and assignment rules remain authoritative.

Example:

```powershell
$body = @{ task = "Review this proposed weekend coverage plan for workload imbalance."; context = @{ note = "Example context" } } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri http://localhost:8088/api/v1/ai/assist -ContentType "application/json" -Body $body
```

In dev auth mode the configured development identity is used automatically. In the company deployment this endpoint should sit behind authenticated SSO just like the rest of the supervisor API.

## Useful commands

```powershell
docker compose ps
docker compose logs -f web api db
git pull
docker compose up -d --build
docker compose exec db psql -U site_assignment -d site_assignment
docker compose down
docker compose exec -T db pg_dump -U site_assignment site_assignment > shifts-backup.sql
```

## Next application milestone

The containers are production-shaped, but the current browser UI still uses localStorage. The next code change should connect `SiteAppState` to `/api/v1/state` so every computer using `shifts.ramessar.io` shares one state.

After that, move workload snapshots, roster, operational weeks, and published assignments into normalized PostgreSQL tables.