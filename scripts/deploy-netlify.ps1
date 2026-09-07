[CmdletBinding()]
param(
    [switch]$Production,
    [string]$SiteId,
    [string]$SiteName,
    [string]$Team,
    [string]$Python = $env:PYTHON,
    [ValidateSet('auto', 'none')][string]$Screenshots = 'auto'
)

$ErrorActionPreference = 'Stop'
if ($SiteId -and $SiteName) { throw 'Choose -SiteId or -SiteName, not both.' }
if ($Team -and -not $SiteName) { throw '-Team is used only with -SiteName when creating a site.' }
if ($SiteName -and $SiteName -notmatch '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$') {
    throw '-SiteName must contain 2-63 lowercase letters, numbers or interior hyphens.'
}
$netlifyName = if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) { 'netlify.cmd' } else { 'netlify' }
$netlifyCommand = Get-Command $netlifyName -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $netlifyCommand) { $netlifyCommand = Get-Command netlify -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $netlifyCommand) { throw 'Netlify CLI is required. Install it with npm install -g netlify-cli, then run netlify login.' }
$netlify = $netlifyCommand.Source
$previousCI = $env:CI
$previousTelemetry = $env:NETLIFY_TELEMETRY_DISABLED
$previousSiteId = $env:NETLIFY_SITE_ID
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if (-not $SiteId -and -not $SiteName) {
        $SiteId = $env:NETLIFY_SITE_ID
        if (-not $SiteId -and (Test-Path -LiteralPath '.netlify/state.json' -PathType Leaf)) {
            $SiteId = (Get-Content -LiteralPath '.netlify/state.json' -Raw | ConvertFrom-Json).siteId
        }
    }
    if (-not $SiteId -and -not $SiteName) {
        throw 'No target selected. Pass -SiteId, set NETLIFY_SITE_ID, link an existing site with netlify link, or explicitly create one with -SiteName.'
    }
    $env:CI = 'true'
    $env:NETLIFY_TELEMETRY_DISABLED = '1'
    if ($SiteName) { $env:NETLIFY_SITE_ID = $null }
    $statusText = & $netlify status --json
    $statusExitCode = $LASTEXITCODE
    $status = ($statusText -join "`n") | ConvertFrom-Json
    if (-not $status.loggedIn) { throw 'Netlify is not authenticated. Run netlify login and try again.' }
    if ($statusExitCode -ne 0 -and $status.error.code -ne 'NOT_LINKED') {
        throw 'Netlify status failed. Resolve the reported error before deploying.'
    }
    if ($SiteName -and $status.linked -and $status.siteData.'site-name' -ne $SiteName) {
        throw 'This directory is linked to a different site. Use -SiteId for an existing target, or run netlify unlink before creating a new site.'
    }
    & (Join-Path $PSScriptRoot 'build-site.ps1') -Python $Python -Screenshots $Screenshots
    $deployArgs = @('deploy', '--dir', 'dist/site', '--no-build', '--json', '--timeout', '600')
    if ($SiteId) { $deployArgs += @('--site', $SiteId) }
    if ($SiteName) { $deployArgs += @('--site-name', $SiteName) }
    if ($Team) { $deployArgs += @('--team', $Team) }
    if ($Production) { $deployArgs += '--prod' }
    & $netlify @deployArgs
    if ($LASTEXITCODE -ne 0) { throw "Netlify deploy failed with exit code $LASTEXITCODE." }
} finally {
    $env:CI = $previousCI
    $env:NETLIFY_TELEMETRY_DISABLED = $previousTelemetry
    $env:NETLIFY_SITE_ID = $previousSiteId
    Pop-Location
}
