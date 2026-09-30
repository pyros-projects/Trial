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
    $artifactOrigin = $null
    if (Test-Path -LiteralPath 'gallery/static/appsettings.json' -PathType Leaf) {
        $artifactOrigin = (Get-Content -LiteralPath 'gallery/static/appsettings.json' -Raw | ConvertFrom-Json).artifactOrigin
    }
    if ($null -ne $artifactOrigin -and $artifactOrigin -isnot [string]) {
        throw 'appsettings.artifactOrigin must be a URL string.'
    }
    $buildParameters = @{ Python = $Python; Screenshots = $Screenshots }
    if ($artifactOrigin) {
        if (-not $SiteId) {
            throw 'Split deployments require an existing site. Create and link the site first, then configure artifactOrigin and pass -SiteId or use netlify link.'
        }
        $sitesText = & $netlify sites:list --json
        if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the existing Netlify site for artifactOrigin.' }
        $sites = ($sitesText -join "`n") | ConvertFrom-Json
        $targetSites = @($sites | Where-Object { $_.id -eq $SiteId })
        if ($targetSites.Count -ne 1 -or -not $targetSites[0].name) {
            throw 'Could not resolve the existing site name. Verify -SiteId and configure artifactOrigin for that site.'
        }
        $targetName = $targetSites[0].name
        $expectedOrigin = "https://builds--$targetName.netlify.app"
        if ($artifactOrigin.TrimEnd('/') -cne $expectedOrigin) {
            throw "appsettings.artifactOrigin must match the target site: $expectedOrigin"
        }
        $artifactAlias = if ($Production) { 'builds' } else { 'builds-preview' }
        $buildParameters.ArtifactOrigin = "https://$artifactAlias--$targetName.netlify.app"
    }
    & (Join-Path $PSScriptRoot 'build-site.ps1') @buildParameters
    if ($artifactOrigin) {
        # The CLI merges headers from build.publish before applying --dir.
        # A separate working directory prevents gallery headers entering this upload.
        $artifactTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $artifactStage = Join-Path $artifactTempRoot ('trial-artifacts-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $artifactStage | Out-Null
        try {
            Copy-Item -LiteralPath 'dist/artifacts' -Destination (Join-Path $artifactStage 'public') -Recurse
            [IO.File]::WriteAllText((Join-Path $artifactStage 'netlify.toml'), "[build]`n  publish = `"public`"`n", [Text.UTF8Encoding]::new($false))
            Push-Location $artifactStage
            try {
                & $netlify deploy --dir public --no-build --json --timeout 600 --site $SiteId --alias $artifactAlias
                if ($LASTEXITCODE -ne 0) { throw "Netlify artifact deploy failed with exit code $LASTEXITCODE. Gallery was not deployed." }
            } finally {
                Pop-Location
            }
        } finally {
            $resolvedStage = [IO.Path]::GetFullPath($artifactStage)
            if ([IO.Path]::GetDirectoryName($resolvedStage) -ne $artifactTempRoot -or [IO.Path]::GetFileName($resolvedStage) -notmatch '^trial-artifacts-[a-f0-9]{32}$') {
                throw 'Refusing to clean an artifact staging directory outside the temporary directory.'
            }
            Remove-Item -LiteralPath $resolvedStage -Recurse -Force
        }
    }
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
