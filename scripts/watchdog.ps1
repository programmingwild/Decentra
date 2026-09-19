<#
.SYNOPSIS
  Watchdog for the Decentra dev stack. Restarts API/web when health fails.
.DESCRIPTION
  Polls /health (API) and / (web) every IntervalSeconds. On consecutive
  failures (FailThreshold) it kills leftovers on the port and relaunches
  via dev_up.ps1 logic inline. Logs to scripts/watchdog.log.
  Run in its own window: powershell -File scripts/watchdog.ps1
  -Cycles limits iterations (0 = forever). Useful for testing the loop.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/watchdog.ps1 -Cycles 2
#>
param([int]$Cycles = 0, [int]$IntervalSeconds = 15, [int]$FailThreshold = 2)

$Root = Split-Path -Parent $PSScriptRoot
$Log = Join-Path $PSScriptRoot "watchdog.log"
$apiFails = 0
$webFails = 0
$n = 0

function Say($msg) {
  $line = "$(Get-Date -Format 'HH:mm:ss') $msg"
  Write-Host $line
  Add-Content -LiteralPath $Log -Value $line -ErrorAction SilentlyContinue
}

function Test-Health($Url) {
  try {
    return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8).StatusCode -eq 200
  } catch { return $false }
}

function Restart-Api {
  Say "watchdog: api unhealthy — restarting"
  foreach ($c in (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
  $log = Join-Path $Root "apps\api\dev_api.log"
  Start-Process -FilePath "python" `
    -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2" `
    -WorkingDirectory (Join-Path $Root "apps\api") `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err"
}

function Restart-Web {
  Say "watchdog: web unhealthy — restarting"
  $webDir = Join-Path $Root "apps\web"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > next_dev2.log 2>&1" -WorkingDirectory $webDir
}

Say "watchdog: watching every ${IntervalSeconds}s (threshold $FailThreshold)"
while ($true) {
  $n++
  if (Test-Health "http://127.0.0.1:8000/health") { $apiFails = 0 } else { $apiFails++ }
  if (Test-Health "http://localhost:3000/") { $webFails = 0 } else { $webFails++ }
  if ($apiFails -ge $FailThreshold) { Restart-Api; $apiFails = 0 }
  if ($webFails -ge $FailThreshold) { Restart-Web; $webFails = 0 }
  if ($Cycles -gt 0 -and $n -ge $Cycles) { Say "watchdog: cycle budget spent, exiting"; break }
  Start-Sleep -Seconds $IntervalSeconds
}
