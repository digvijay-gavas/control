# Minimal static file server for the Controller Game Hub.
# start.bat uses it only when Python isn't available: it needs nothing but the
# PowerShell that ships with Windows. Serves the repo folder on localhost only.
param([int]$Port = 8765)

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")).TrimEnd('\') + '\'
$pidFile = Join-Path $root ".server.pid"
$types = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".json" = "application/json"; ".md" = "text/plain; charset=utf-8"; ".txt" = "text/plain; charset=utf-8"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".gif" = "image/gif"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"
  ".wav" = "audio/wav"; ".mp3" = "audio/mpeg"; ".ogg" = "audio/ogg"; ".woff2" = "font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Host "Could not listen on port ${Port}: $($_.Exception.Message)"; exit 1 }
# stop.bat reads this: the port belongs to Windows' http.sys, not to this process
Set-Content -Path $pidFile -Value $PID
$host.UI.RawUI.WindowTitle = "Game Hub server"
Write-Host "Game Hub running at http://localhost:$Port/"
Write-Host "Run stop.bat or close this window to stop it."

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/').Replace('/', '\')
      $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not ($path + '\').StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $res.StatusCode = 403                               # outside the repo folder
      } elseif (Test-Path -LiteralPath $path -PathType Container) {
        if (-not $req.Url.AbsolutePath.EndsWith('/')) {     # keep relative links working
          $res.StatusCode = 301; $res.RedirectLocation = $req.Url.AbsolutePath + '/'
        } else { $path = Join-Path $path "index.html" }
      }
      if ($res.StatusCode -eq 200) {
        if (Test-Path -LiteralPath $path -PathType Leaf) {
          $bytes = [IO.File]::ReadAllBytes($path)
          $type = $types[[IO.Path]::GetExtension($path).ToLower()]
          $res.ContentType = if ($type) { $type } else { "application/octet-stream" }
          $res.AddHeader("Cache-Control", "no-cache")
          $res.ContentLength64 = $bytes.Length
          if ($req.HttpMethod -ne "HEAD") { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
        } else { $res.StatusCode = 404 }
      }
    } catch { $res.StatusCode = 500 } finally { $res.Close() }
  }
} finally {
  $listener.Stop()
  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
}
