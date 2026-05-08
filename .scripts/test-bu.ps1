param(
  [Parameter(Mandatory=$true)][string]$Key
)
$ErrorActionPreference = 'Continue'

Write-Host "Testing key (masked): $($Key.Substring(0,6))...$($Key.Substring($Key.Length-4))  length=$($Key.Length)"

function Try-Endpoint($name, $url, $headers) {
  Write-Host "--- $name : $url ---"
  try {
    $r = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 30
    Write-Host "STATUS: $($r.StatusCode)"
    Write-Host $r.Content
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      Write-Host "STATUS: $([int]$resp.StatusCode)"
      try {
        $stream = $resp.GetResponseStream()
        $stream.Position = 0
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "BODY: $body"
      } catch { Write-Host "(no body)" }
    } else {
      Write-Host "ERROR: $($_.Exception.Message)"
    }
  }
}

$h = @{ 'X-Browser-Use-API-Key' = $Key }

Try-Endpoint 'v3/sessions GET'  'https://api.browser-use.com/api/v3/sessions?limit=1' $h
Try-Endpoint 'v2/tasks    GET'  'https://api.browser-use.com/api/v2/tasks?limit=1'    $h
Try-Endpoint 'v2/profiles GET'  'https://api.browser-use.com/api/v2/profiles'         $h
Try-Endpoint 'v2/me        GET' 'https://api.browser-use.com/api/v2/users/me'         $h
