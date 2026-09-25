$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "Created .env from .env.example." -ForegroundColor Yellow
    Write-Host "Edit .env and set POSTGRES_PASSWORD, DATABASE_URL, supervisor emails, and AI_API_KEY, then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Building and starting Site Coverage..." -ForegroundColor Cyan
docker compose up -d --build

Write-Host ""
docker compose ps

Write-Host ""
Write-Host "Site Coverage: http://localhost:8088" -ForegroundColor Green
Write-Host "API docs:      http://localhost:8088/api/docs" -ForegroundColor Green
Write-Host "Health:        http://localhost:8088/healthz" -ForegroundColor Green
Write-Host ""
Write-Host "Cloudflare hostname: shifts.ramessar.io -> http://localhost:8088" -ForegroundColor Cyan