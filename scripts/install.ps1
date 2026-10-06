# RotMG Companion — install or update to the latest release, then launch it.
# One line in PowerShell:
#   irm https://github.com/pendragonzzz/rotmg-companion/releases/latest/download/install.ps1 | iex
# The installer replaces any older installed version in place; on first launch the app moves
# old copies (the old .bat launcher, old -portable/-setup .exe downloads, stale shortcuts)
# off your Desktop into the Recycle Bin.
$ErrorActionPreference = 'Stop'
$repo = 'pendragonzzz/rotmg-companion'
$headers = @{ 'User-Agent' = 'rotmg-companion-installer' }

Write-Host 'Finding the latest RotMG Companion release...'
$rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers $headers
$asset = $rel.assets | Where-Object { $_.name -like 'RotMG-Companion-*-setup.exe' } | Select-Object -First 1
if (-not $asset) { throw 'No installer found on the latest release.' }

$out = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest $asset.browser_download_url -OutFile $out -UseBasicParsing

# Never run a file we can't verify when GitHub publishes its checksum.
if ($asset.digest -and $asset.digest -like 'sha256:*') {
  $hash = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
  if ("sha256:$hash" -ne $asset.digest.ToLower()) { Remove-Item $out -Force; throw 'Checksum mismatch - download discarded.' }
}

Write-Host 'Installing (replaces any older version)...'
Start-Process -FilePath $out -ArgumentList '/S' -Wait
Remove-Item $out -Force -ErrorAction SilentlyContinue

$exe = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\rotmg-companion\RotMG Companion.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\RotMG Companion\RotMG Companion.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($exe) { Start-Process $exe }
Write-Host "Done - $($rel.tag_name) is installed with a Desktop shortcut."
