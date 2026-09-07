$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 gallery/server.py --open @args
} else {
    & python gallery/server.py --open @args
}
