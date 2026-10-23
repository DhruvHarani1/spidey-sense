# Builds the Windows installer while avoiding electron-builder's "extract to .tmp then rename" step,
# which fails with EPERM when antivirus real-time scanning locks the freshly extracted files.
#   1) uses the Electron already unpacked in node_modules (electronDist)
#   2) finds (or lets electron-builder download) the 7-Zip, NSIS and NSIS-resources archives in its cache,
#      extracts them itself into a stable tools folder, and points electron-builder at them with environment variables
# Works with electron-builder 26.x (7zip / nsis / nsis-resources toolsets). Usage: npm run dist
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cache = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache'
$tools = Join-Path $env:LOCALAPPDATA 'lyra-build-tools'   # shared with the Lyra project on purpose
New-Item -ItemType Directory -Force $tools | Out-Null

function Find-First($filter) {
  Get-ChildItem $cache -Recurse -Filter $filter -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | Select-Object -First 1
}

# let electron-builder download whatever is missing; its own rename step may fail afterwards, which is fine: the files stay in the cache
function Prime-Cache {
  Write-Host 'Letting electron-builder download its build tools (a rename error right after the download is expected and harmless)...'
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  npx electron-builder --win nsis "-c.electronDist=node_modules/electron/dist" 2>&1 | Out-Null
  $ErrorActionPreference = $old
}

# ---- 7-Zip: a stable copy of 7za.exe (+ its folder)
$sevenDir = Join-Path $tools '7zip'
$sevenZip = Join-Path $sevenDir '7za.exe'
if (-not (Test-Path $sevenZip)) {
  $found = Find-First '7za.exe'
  if (-not $found) { Prime-Cache; $found = Find-First '7za.exe' }
  if (-not $found) { throw "Could not find 7za.exe in $cache" }
  New-Item -ItemType Directory -Force $sevenDir | Out-Null
  Copy-Item (Join-Path $found.DirectoryName '*') $sevenDir -Recurse -Force
}

function Ensure-Extracted($name, $archiveFilter, $dest) {
  if (Test-Path (Join-Path $dest '*')) { return }
  $archive = Find-First $archiveFilter
  if (-not $archive) { Prime-Cache; $archive = Find-First $archiveFilter }
  if (-not $archive) { throw "Could not find the $name archive ($archiveFilter) in $cache" }
  New-Item -ItemType Directory -Force $dest | Out-Null
  & $sevenZip x -y "-o$dest" $archive.FullName | Out-Null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $dest '*'))) { throw "Could not extract $($archive.FullName)" }
}

$nsis = Join-Path $tools 'nsis'
$res = Join-Path $tools 'nsis-resources'
Ensure-Extracted 'NSIS' 'nsis-3.*.7z' $nsis
Ensure-Extracted 'NSIS resources' 'nsis-resources-*.7z' $res

$env:ELECTRON_BUILDER_7ZIP_PATH = $sevenZip
$env:ELECTRON_BUILDER_NSIS_DIR = $nsis
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = $res
$ver = (Get-Content (Join-Path $root 'node_modules\electron\package.json') | ConvertFrom-Json).version

Remove-Item -Recurse -Force (Join-Path $root 'release') -ErrorAction SilentlyContinue
npx electron-builder --win nsis "-c.electronDist=node_modules/electron/dist" "-c.electronVersion=$ver"
if ($LASTEXITCODE -ne 0) { throw 'electron-builder failed' }
Write-Host "Installer: $(Join-Path $root 'release')"
