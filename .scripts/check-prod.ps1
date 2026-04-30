param(
  [string]$Base = 'https://datakult-dashboard.vercel.app'
)
$ErrorActionPreference = 'Continue'

function Invoke-Endpoint($path) {
  Write-Host ('=== {0} ===' -f $path)
  try {
    $r = Invoke-WebRequest -Uri ($Base + $path) -UseBasicParsing -TimeoutSec 290
    Write-Host ('Status: {0}' -f $r.StatusCode)
    Write-Host ('Length: {0}' -f $r.RawContentLength)
    Write-Host '---'
    Write-Host $r.Content
  } catch {
    Write-Host ('ERROR: {0}' -f $_.Exception.Message)
    if ($_.Exception.Response) {
      $resp = $_.Exception.Response
      Write-Host ('HTTP Status: {0}' -f [int]$resp.StatusCode)
      try {
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host '---'
        Write-Host $body
      } catch {}
    }
  }
  Write-Host ''
}

Invoke-Endpoint '/api/health/env'
Invoke-Endpoint '/api/triage/collect'
