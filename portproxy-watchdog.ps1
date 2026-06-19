# portproxy-watchdog.ps1  (runs as SYSTEM via Scheduled Task, no UAC)
# Silently checks and re-applies the WSL portproxy if the socket has dropped.

$port = 8000
$wslDistro = "Ubuntu"

# Quick check: is the socket actually bound?
$listening = netstat -ano | Select-String ":$port " | Select-String "LISTENING"
if ($listening) { exit 0 }   # already up, nothing to do

# Socket is gone — re-detect WSL IP and restore
$wslIp = (wsl -d $wslDistro -- bash -c "hostname -I | awk '{print `$1}'").Trim()
if (-not $wslIp) { exit 1 }

foreach ($addr in @('0.0.0.0','127.0.0.1','192.168.1.3')) {
    netsh interface portproxy delete v4tov4 listenaddress=$addr listenport=$port 2>$null | Out-Null
}
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$port connectaddress=$wslIp connectport=$port | Out-Null
