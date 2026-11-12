param([ValidateSet('serve','test','evaluate','prepare_offline','verify','export')][string]$Mode = 'serve', [switch]$Offline)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$bundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$pythonPath = $null
if (Test-Path -LiteralPath $bundledPython) { $pythonPath = $bundledPython }
elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonPath = & py -3 -c 'import sys; print(sys.executable)'
    if ($LASTEXITCODE -ne 0) { $pythonPath = $null }
}
if (-not $pythonPath) { throw 'Python 3.11 or newer is required. Install Python from python.org, then run this file again.' }
$deps = Join-Path $projectRoot '.runtime-deps'
$tempRoot = Join-Path $projectRoot '.setup-temp'
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$env:TEMP = $tempRoot
$env:TMP = $tempRoot
if ($Mode -notin @('prepare_offline','verify') -and -not (Test-Path -LiteralPath (Join-Path $deps '.installed'))) {
    Write-Host 'Installing pinned dependencies inside this project.'
    $requirements = Join-Path $projectRoot 'requirements.lock.txt'
    if (-not (Test-Path -LiteralPath $requirements)) { $requirements = Join-Path $projectRoot 'requirements.txt' }
    if ($Offline) {
        $wheels = Join-Path $projectRoot 'wheelhouse'
        if (-not (Test-Path -LiteralPath (Join-Path $wheels 'manifest.json'))) {
            throw 'Offline wheels are missing. Run PREPARE_OFFLINE.cmd online, or open offline-demo/index.html for the read-only backup.'
        }
        & $pythonPath (Join-Path $PSScriptRoot 'check_wheels.py')
        if ($LASTEXITCODE -ne 0) { throw 'Offline wheel verification failed.' }
        & $pythonPath -m pip install --no-index --find-links $wheels --no-cache-dir --target $deps -r $requirements
    } else {
        & $pythonPath -m pip install --no-cache-dir --target $deps -r $requirements
    }
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the error above and your internet connection.' }
    Set-Content -LiteralPath (Join-Path $deps '.installed') -Value 'installed'
}
if ($Offline -and $Mode -eq 'serve') {
    $env:CARERELAY_OFFLINE = '1'
    Write-Host 'Offline server mode: live AI requests are disabled.'
}
if ($Mode -eq 'serve') { Write-Host "Open http://127.0.0.1:$(if ($env:PORT) {$env:PORT} else {'8000'}) in your browser. Press Ctrl+C here to stop." }
& $pythonPath (Join-Path $PSScriptRoot 'boot.py') $Mode
if ($LASTEXITCODE -ne 0) { throw "CareRelay exited with code $LASTEXITCODE" }
