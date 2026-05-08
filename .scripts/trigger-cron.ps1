$ErrorActionPreference = 'Continue'
Write-Host 'POST /api/triage/run ...'
try {
  $r = Invoke-WebRequest -Uri 'https://datakult-dashboard.vercel.app/api/triage/run' -Method POST -UseBasicParsing -TimeoutSec 290
  Write-Host ('STATUS: {0}' -f $r.StatusCode)
  Write-Host $r.Content
} catch {
  Write-Host ('ERR: {0}' -f $_.Exception.Message)
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
  }
}
