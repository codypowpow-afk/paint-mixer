# Builds dist\PaintMixer.exe: a single offline exe with the web app and WebView2 SDK embedded.
# Needs only what ships with Windows (.NET Framework 4.x csc.exe). The WebView2 NuGet package
# is downloaded once into desktop\packages on first build.
#   powershell -ExecutionPolicy Bypass -File desktop\build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$desk = $PSScriptRoot
$wv2Version = '1.0.4314.35'
$pkg = Join-Path $desk "packages\webview2.$wv2Version"

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "csc.exe not found at $csc (.NET Framework 4.x is required)" }

if (-not (Test-Path $pkg)) {
    Write-Host "Downloading WebView2 SDK $wv2Version..."
    New-Item -ItemType Directory -Force $pkg | Out-Null
    $zip = Join-Path $pkg 'pkg.zip'
    Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$wv2Version/microsoft.web.webview2.$wv2Version.nupkg" -OutFile $zip
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $pkg)
    Remove-Item $zip
}

$icon = Join-Path $desk 'icon.ico'

$lib = Join-Path $pkg 'lib\net462'
$core = Join-Path $lib 'Microsoft.Web.WebView2.Core.dll'
$winforms = Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll'
$loader = Join-Path $pkg 'runtimes\win-x64\native\WebView2Loader.dll'

$resources = @(
    "/resource:$core,lib/Microsoft.Web.WebView2.Core.dll",
    "/resource:$winforms,lib/Microsoft.Web.WebView2.WinForms.dll",
    "/resource:$loader,native/WebView2Loader.dll"
)
$web = @('index.html', 'style.css') + (Get-ChildItem (Join-Path $root 'js') -Filter *.js | ForEach-Object { 'js/' + $_.Name })
foreach ($f in $web) { $resources += "/resource:$(Join-Path $root $f),web/$f" }

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$exe = Join-Path $dist 'PaintMixer.exe'

& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$exe" "/win32icon:$icon" `
    /r:System.Windows.Forms.dll /r:System.Drawing.dll "/r:$core" "/r:$winforms" `
    $resources (Join-Path $desk 'PaintMixer.cs')
if ($LASTEXITCODE -ne 0) { throw "csc failed ($LASTEXITCODE)" }
Write-Host "Built $exe ($([math]::Round((Get-Item $exe).Length / 1MB, 2)) MB)"
