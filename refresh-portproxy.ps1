# refresh-portproxy.ps1  (must run as Administrator)
# Detects current WSL IP and binds port 8000 on all interfaces -> WSL Octane

$wslIp = (wsl -d Ubuntu -- bash -c "hostname -I | awk '{print $1}'").Trim()
if (-not $wslIp) {
    Write-Host "ERROR: Could not detect WSL IP. Is Ubuntu running?" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "WSL IP: $wslIp" -ForegroundColor Cyan

# Remove any existing rules on port 8000
foreach ($addr in @('0.0.0.0','127.0.0.1','192.168.1.3')) {
    netsh interface portproxy delete v4tov4 listenaddress=$addr listenport=8000 2>$null | Out-Null
}

# Listen on all interfaces so both localhost and LAN IP work
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8000 connectaddress=$wslIp connectport=8000

Write-Host "Portproxy set: 0.0.0.0:8000 -> $wslIp:8000" -ForegroundColor Green
Start-Sleep -Seconds 1
