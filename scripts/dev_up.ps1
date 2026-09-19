<#
.SYNOPSIS
  Starts the Decentra dev stack (API + web) if not already running.
.DESCRIPTION
  Idempotent: checks ports first, only launches what's missing.
  API runs 2 workers (matches production); web runs next dev.
  Logs go to apps/api/dev_api.log and apps/web/dev_web.log.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ApiDir = Join-Path $Root "apps\api"
$WebDir = Join-Path $Root "apps\web"

function Test-Port($Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Test-Health($Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
    return $r.StatusCode -eq 200
  } catch { return $false }
}

# API
if ((Test-Port 8000) -and (Test-Health "http://127.0.0.1:8000/health")) {
  Write-Host "api   : already up (:8000)" -ForegroundColor Green
} else {
  $log = Join-Path $ApiDir "dev_api.log"
  Start-Process -FilePath "python" `
    -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2" `
    -WorkingDirectory $ApiDir `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  Write-Host "api   : launching (log: dev_api.log) - slow boxes need ~90s" -ForegroundColor Yellow
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Seconds 4
    if (Test-Health "http://127.0.0.1:8000/health") { break }
  }
  if (Test-Health "http://127.0.0.1:8000/health") {
    Write-Host "api   : healthy" -ForegroundColor Green
  } else {
    Write-Host "api   : FAILED to come up - see apps/api/dev_api.log" -ForegroundColor Red
    exit 1
  }
}

# Web
if (Test-Port 3000) {
  Write-Host "web   : already listening (:3000)" -ForegroundColor Green
} else {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > next_dev2.log 2>&1" -WorkingDirectory $WebDir
  Write-Host "web   : launching (log: apps/web/next_dev2.log)..." -ForegroundColor Yellow
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 5
    if (Test-Port 3000) { break }
  }
  if (Test-Port 3000) {
    Write-Host "web   : listening" -ForegroundColor Green
  } else {
    Write-Host "web   : FAILED to come up" -ForegroundColor Red
    exit 1
  }
}

Write-Host "stack : web http://localhost:3000 - api http://127.0.0.1:8000" -ForegroundColor Cyan
