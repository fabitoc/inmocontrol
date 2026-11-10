$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$distDir = Join-Path $projectRoot "dist"
$assetsDir = Join-Path $distDir "assets"
$releaseDir = Join-Path $projectRoot "release"
$embedDir = Join-Path $distDir "embed_staging"

if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
}
if (-not (Test-Path $embedDir)) {
    New-Item -ItemType Directory -Path $embedDir | Out-Null
}

$jsFile = Get-ChildItem -Path $assetsDir -Filter "*.js" | Select-Object -First 1
$cssFile = Get-ChildItem -Path $assetsDir -Filter "*.css" | Select-Object -First 1

if (-not $jsFile -or -not $cssFile) {
    throw "Frontend build artifacts not found in dist/assets. Run 'npm run build' first."
}

$stagedJs = Join-Path $embedDir "app.js"
$stagedCss = Join-Path $embedDir "app.css"
$stagedHtml = Join-Path $embedDir "index.html"

Copy-Item -Path $jsFile.FullName -Destination $stagedJs -Force
Copy-Item -Path $cssFile.FullName -Destination $stagedCss -Force

$rawHtml = Get-Content -Path (Join-Path $distDir "index.html") -Raw -Encoding UTF8
$rewrittenHtml = $rawHtml `
    -replace '/assets/index-[^"]+\.js', '/assets/app.js' `
    -replace '/assets/index-[^"]+\.css', '/assets/app.css' `
    -replace '<script type="module"', '<script src="/api/init-db.js"></script><script type="module"'

[System.IO.File]::WriteAllText($stagedHtml, $rewrittenHtml, (New-Object System.Text.UTF8Encoding($false)))

$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

$outReleaseExe = Join-Path $releaseDir "InmoControl-2.0.exe"
$outRootExe = Join-Path $projectRoot "InmoControl-2.0.exe"
$csSource = Join-Path $projectRoot "launcher\InmoControlLauncher.cs"

& $cscPath `
    /nologo `
    /target:winexe `
    /optimize+ `
    "/out:$outReleaseExe" `
    "/resource:$stagedHtml,index.html" `
    "/resource:$stagedCss,app.css" `
    "/resource:$stagedJs,app.js" `
    /r:System.dll `
    /r:System.Drawing.dll `
    /r:System.Windows.Forms.dll `
    $csSource

if ($LASTEXITCODE -ne 0) {
    throw "Compilation with csc.exe failed with exit code $LASTEXITCODE"
}

Copy-Item -Path $outReleaseExe -Destination $outRootExe -Force

Write-Host "Portable executable built successfully:"
Write-Host " - $outRootExe"
Write-Host " - $outReleaseExe"
