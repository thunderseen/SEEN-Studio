$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

$ordersFile  = Join-Path $dataDir "orders.json"
$catalogFile = Join-Path $dataDir "catalog.json"
$configFile  = Join-Path $dataDir "config.json"

if (-not (Test-Path $ordersFile))  { "[]" | Set-Content -Path $ordersFile -Encoding UTF8 }
if (-not (Test-Path $configFile))  { '{"webhook":"","sslStore":"","waNumber":"8801307758119"}' | Set-Content -Path $configFile -Encoding UTF8 }

$port = 8787
$server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
try {
  $server.Start()
} catch {
  Write-Output "Server already running on http://127.0.0.1:$port/"
  exit 0
}
Write-Output "SEEN Full-Stack Store Server active on http://127.0.0.1:$port/ (DB: $dataDir)"

function Send-HttpResponse($stream, [int]$code, [string]$statusText, [string]$contentType, [byte[]]$bodyBytes) {
  $hdr = [System.Text.Encoding]::ASCII.GetBytes(
    "HTTP/1.1 $code $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($bodyBytes.Length)`r`nCache-Control: no-cache`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, PATCH, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nConnection: close`r`n`r`n"
  )
  $stream.Write($hdr, 0, $hdr.Length)
  if ($bodyBytes.Length -gt 0) { $stream.Write($bodyBytes, 0, $bodyBytes.Length) }
  $stream.Flush()
}

function Send-Json($stream, [int]$code, [string]$statusText, [string]$jsonStr) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
  Send-HttpResponse $stream $code $statusText "application/json; charset=utf-8" $bytes
}

while ($true) {
  $client = $server.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 8000

    # Read raw HTTP headers byte-by-byte until \r\n\r\n so exact Content-Length body bytes remain intact!
    $ms = [System.IO.MemoryStream]::new()
    $prev = @(0,0,0,0)
    $b = 0
    while ($true) {
      $b = $stream.ReadByte()
      if ($b -lt 0) { break }
      $ms.WriteByte([byte]$b)
      $prev[0] = $prev[1]; $prev[1] = $prev[2]; $prev[2] = $prev[3]; $prev[3] = $b
      if ($prev[0] -eq 13 -and $prev[1] -eq 10 -and $prev[2] -eq 13 -and $prev[3] -eq 10) { break }
      if ($ms.Length -gt 65536) { break }
    }
    $headerText = [System.Text.Encoding]::ASCII.GetString($ms.ToArray())
    $ms.Dispose()
    if ([string]::IsNullOrWhiteSpace($headerText)) { continue }

    $lines = $headerText -split "`r`n"
    $reqLine = $lines[0]
    $method = "GET"
    $rawPath = "/"
    if ($reqLine -match "^([A-Z]+)\s+([^\s?]+)") {
      $method = $Matches[1]
      $rawPath = [System.Uri]::UnescapeDataString($Matches[2])
    }

    $contentLen = 0
    foreach ($ln in $lines) {
      if ($ln -match "^Content-Length:\s*(\d+)") { $contentLen = [int]$Matches[1] }
    }

    $bodyStr = ""
    if ($contentLen -gt 0 -and $contentLen -lt 25000000) {
      $bodyBuf = New-Object byte[] $contentLen
      $readTotal = 0
      while ($readTotal -lt $contentLen) {
        $n = $stream.Read($bodyBuf, $readTotal, $contentLen - $readTotal)
        if ($n -le 0) { break }
        $readTotal += $n
      }
      $bodyStr = [System.Text.Encoding]::UTF8.GetString($bodyBuf, 0, $readTotal)
    }

    if ($method -eq "OPTIONS") {
      Send-HttpResponse $stream 204 "No Content" "text/plain" ([byte[]]@())
      continue
    }

    # ---------------- FULL-STACK REST API ROUTES ----------------
    if ($rawPath -eq "/api/health" -and $method -eq "GET") {
      $parsed = Get-Content -Raw -Path $ordersFile -Encoding UTF8 | ConvertFrom-Json
      $ordArr = @($parsed | Where-Object { $_ -ne $null })
      $resp = (@{ ok = $true; mode = "full-stack"; ordersCount = $ordArr.Count; serverTime = (Get-Date).ToString("o") } | ConvertTo-Json -Compress)
      Send-Json $stream 200 "OK" $resp
      continue
    }

    if ($rawPath -eq "/api/orders" -and $method -eq "GET") {
      $raw = Get-Content -Raw -Path $ordersFile -Encoding UTF8
      if ([string]::IsNullOrWhiteSpace($raw)) { $raw = "[]" }
      Send-Json $stream 200 "OK" $raw
      continue
    }

    if ($rawPath -eq "/api/orders" -and $method -eq "POST") {
      $newOrd = $bodyStr | ConvertFrom-Json
      $parsed = Get-Content -Raw -Path $ordersFile -Encoding UTF8 | ConvertFrom-Json
      $existing = @($parsed | Where-Object { $_ -ne $null })
      $updated = @($newOrd) + $existing
      ConvertTo-Json -InputObject @($updated) -Depth 10 | Set-Content -Path $ordersFile -Encoding UTF8
      $ack = (@{ ok = $true; id = $newOrd.id; totalOrders = $updated.Count } | ConvertTo-Json -Compress)
      Send-Json $stream 201 "Created" $ack
      continue
    }

    if ($rawPath -eq "/api/orders/status" -and ($method -eq "POST" -or $method -eq "PATCH")) {
      $patch = $bodyStr | ConvertFrom-Json
      $parsed = Get-Content -Raw -Path $ordersFile -Encoding UTF8 | ConvertFrom-Json
      $existing = @($parsed | Where-Object { $_ -ne $null })
      $found = $false
      foreach ($o in $existing) {
        if ($o.id -eq $patch.id) {
          $o.status = $patch.status
          $found = $true
        }
      }
      if ($found) {
        ConvertTo-Json -InputObject @($existing) -Depth 10 | Set-Content -Path $ordersFile -Encoding UTF8
        Send-Json $stream 200 "OK" '{"ok":true}'
      } else {
        Send-Json $stream 404 "Not Found" '{"ok":false,"error":"Order not found"}'
      }
      continue
    }

    if ($rawPath -eq "/api/catalog" -and $method -eq "GET") {
      if (Test-Path $catalogFile) {
        $raw = Get-Content -Raw -Path $catalogFile -Encoding UTF8
        Send-Json $stream 200 "OK" $raw
      } else {
        Send-Json $stream 200 "OK" "null"
      }
      continue
    }

    if ($rawPath -eq "/api/catalog" -and $method -eq "POST") {
      [System.IO.File]::WriteAllText($catalogFile, $bodyStr, [System.Text.Encoding]::UTF8)
      Send-Json $stream 200 "OK" '{"ok":true}'
      continue
    }

    if ($rawPath -eq "/api/config" -and $method -eq "GET") {
      $raw = Get-Content -Raw -Path $configFile -Encoding UTF8
      Send-Json $stream 200 "OK" $raw
      continue
    }

    if ($rawPath -eq "/api/config" -and $method -eq "POST") {
      [System.IO.File]::WriteAllText($configFile, $bodyStr, [System.Text.Encoding]::UTF8)
      Send-Json $stream 200 "OK" '{"ok":true}'
      continue
    }

    # ---------------- STATIC FILE SERVER ----------------
    $rel = $rawPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root ($rel -replace '/', '\')))
    $rootFull = [System.IO.Path]::GetFullPath($root)
    if ($full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $full -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = switch ($ext) {
        ".html" { "text/html; charset=utf-8" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".webp" { "image/webp" }
        ".css"  { "text/css; charset=utf-8" }
        ".js"   { "application/javascript; charset=utf-8" }
        ".svg"  { "image/svg+xml" }
        ".json" { "application/json; charset=utf-8" }
        ".ico"  { "image/x-icon" }
        default { "application/octet-stream" }
      }
      $body = [System.IO.File]::ReadAllBytes($full)
      Send-HttpResponse $stream 200 "OK" $ct $body
    } else {
      $nf = [System.Text.Encoding]::ASCII.GetBytes("Not Found")
      Send-HttpResponse $stream 404 "Not Found" "text/plain" $nf
    }
  } catch {} finally { if ($client) { $client.Close() } }
}
