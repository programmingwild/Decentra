<#
.SYNOPSIS
  Decentra smoke test - API health + auth + key web routes.
.DESCRIPTION
  Fails fast with clear output. Run while the stack is up
  (docker compose up, or uvicorn :8000 + next dev :3000).
  Compatible with Windows PowerShell 5.1 and PowerShell 7+.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1
#>
$ErrorActionPreference = "Stop"

if ($env:DECENTRA_API_URL) { $Api = $env:DECENTRA_API_URL } else { $Api = "http://localhost:8000" }
if ($env:DECENTRA_WEB_URL) { $Web = $env:DECENTRA_WEB_URL } else { $Web = "http://localhost:3000" }
$script:failed = 0

function Check($label, [scriptblock]$fn) {
  try {
    & $fn | Out-Null
    Write-Host ("  ok   " + $label) -ForegroundColor Green
  } catch {
    $script:failed = $script:failed + 1
    Write-Host ("  FAIL " + $label + " :: " + $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host "Decentra smoke test"
Write-Host ("  api=" + $Api + " web=" + $Web)
Write-Host ""

Check "API /health" {
  $r = Invoke-WebRequest -Uri "$Api/health" -UseBasicParsing -TimeoutSec 10
  if ($r.StatusCode -ne 200) { throw ("HTTP " + $r.StatusCode) }
}

Check "API demo login" {
  $body = @{ email = "demo@decentra.ai"; password = "demo1234" } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "$Api/api/v1/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 15
  $j = $r.Content | ConvertFrom-Json
  if (-not $j.access_token) { throw "no access_token in response" }
}

Check "API refresh rejects empty" {
  try {
    Invoke-WebRequest -Uri "$Api/api/v1/auth/refresh" -Method POST -Body "{}" -ContentType "application/json" -UseBasicParsing -TimeoutSec 10 | Out-Null
    throw "expected 400"
  } catch {
    if ($_.Exception.Message -notmatch "400|expected 400") { throw $_ }
  }
}

Check "API unauth envelope" {
  try {
    Invoke-WebRequest -Uri "$Api/api/v1/auth/me" -UseBasicParsing -TimeoutSec 10 | Out-Null
    throw "expected 401"
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match "expected 401") { throw "me endpoint allowed anonymous access" }
    if ($msg -notmatch "401") { throw $_ }
  }
}

Check "API docs reachable" {
  $r = Invoke-WebRequest -Uri "$Api/docs" -UseBasicParsing -TimeoutSec 10
  if ($r.StatusCode -ne 200) { throw ("HTTP " + $r.StatusCode) }
}

foreach ($p in @("/", "/login", "/overview", "/meetings", "/decisions", "/actions", "/analytics")) {
  $path = $p
  Check ("web " + $path) {
    $r = Invoke-WebRequest -Uri ($Web + $path) -UseBasicParsing -TimeoutSec 30
    if ($r.StatusCode -ne 200) { throw ("HTTP " + $r.StatusCode) }
    if ($r.RawContentLength -lt 5000) { throw ("suspiciously small body") }
  }
}

Write-Host ""
if ($failed -gt 0) { Write-Host ($failed.ToString() + " check(s) FAILED") -ForegroundColor Red; exit 1 }
Write-Host "All checks passed." -ForegroundColor Green
