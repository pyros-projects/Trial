[CmdletBinding()]
param(
    [string]$Python = $env:PYTHON,
    [ValidateSet('auto', 'none')][string]$Screenshots = 'auto',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$pythonArgs = @()
if (-not $Python) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $Python = 'py'
        $pythonArgs = @('-3')
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $Python = 'python'
    } else {
        throw 'Python 3.11 or newer is required. Install Python or pass -Python with its executable path.'
    }
}
$buildArgs = @('tools/build_site.py', '--screenshots', $Screenshots)
if ($Json) { $buildArgs += '--json' }
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    & $Python @pythonArgs @buildArgs
    if ($LASTEXITCODE -ne 0) { throw "Static export failed with exit code $LASTEXITCODE." }
} finally {
    Pop-Location
}
