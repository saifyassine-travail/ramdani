# fast-backend.ps1
# Runs the Laravel backend FAST via Laravel Octane (RoadRunner) inside WSL2 Ubuntu.
#
# Why WSL: Octane needs the Unix `pcntl` extension (unavailable on Windows), and
# RoadRunner needs a real Linux filesystem (the /mnt/c mount is too slow). So the
# backend code is mirrored into WSL at ~/mediassist and served there. The DATABASE
# stays as your Windows PostgreSQL (reachable from WSL via mirrored networking),
# so there is only ONE database — no data divergence.
#
# Usage:
#   .\fast-backend.ps1            # sync code -> WSL, then START Octane (keep this window open)
#   .\fast-backend.ps1 -Reload    # sync code -> WSL, then RELOAD workers (use after editing backend code while it runs)
#
# After changing composer dependencies, run once in WSL:
#   wsl -d Ubuntu -- bash -lc "cd ~/mediassist && COMPOSER_ALLOW_SUPERUSER=1 composer install --ignore-platform-reqs"

param([switch]$Reload)

# Derive the backend path from this script's own location so it works on any
# machine (no hardcoded user/path). Convert C:\path -> /mnt/c/path in pure
# PowerShell to avoid backslash mangling when passing args through wsl.
$backendWin = Join-Path $PSScriptRoot "Backend\MediAssist"
$drive = $backendWin.Substring(0, 1).ToLower()
$src = "/mnt/$drive" + $backendWin.Substring(2).Replace('\', '/')
if (-not (Test-Path $backendWin)) {
    Write-Host "ERROR: backend not found at $backendWin" -ForegroundColor Red
    exit 1
}

# With WSL2 mirrored networking, WSL reaches the Windows PostgreSQL via
# 127.0.0.1 (the source .env ships DB_HOST=localhost, which we normalize here).
$dbHost = "127.0.0.1"

Write-Host "Syncing backend code -> WSL (~/mediassist)..." -ForegroundColor Cyan
wsl -d Ubuntu -- bash -c "rsync -a --delete --exclude vendor --exclude node_modules --exclude .git --exclude rr --exclude 'storage/logs/*' '$src/' ~/mediassist/ && sed -i 's/^DB_HOST=.*/DB_HOST=$dbHost/' ~/mediassist/.env"

if ($Reload) {
    Write-Host "Reloading Octane workers..." -ForegroundColor Cyan
    wsl -d Ubuntu -- bash -lc "cd ~/mediassist && php artisan octane:reload"
}
else {
    Write-Host "Starting Octane on http://localhost:8000  (press Ctrl+C to stop)" -ForegroundColor Green
    wsl -d Ubuntu -- bash -lc "cd ~/mediassist && php artisan octane:start --server=roadrunner --host=0.0.0.0 --port=8000 --workers=4"
}
