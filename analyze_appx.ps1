# Comprehensive AppX Package Analysis

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  APPX PACKAGE SPACE ANALYSIS" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Get packages from AppData\Local\Packages
$packagesPath = 'C:\Users\Trey\AppData\Local\Packages'
$results = @()

Write-Host "Scanning package sizes in: $packagesPath" -ForegroundColor Gray
Write-Host ""

Get-ChildItem -Path $packagesPath -Directory | ForEach-Object {
    $folderPath = $_.FullName
    $folderName = $_.Name
    try {
        $size = (Get-ChildItem -Path $folderPath -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        if ($null -eq $size) { $size = 0 }
    } catch {
        $size = 0
    }
    $results += [PSCustomObject]@{
        PackageName = $folderName
        SizeMB = [math]::Round($size / 1MB, 2)
        SizeGB = [math]::Round($size / 1GB, 2)
    }
}

$totalGB = ($results | Measure-Object -Property SizeMB -Sum).Sum / 1024
Write-Host "TOTAL SIZE: $([math]::Round($totalGB, 2)) GB" -ForegroundColor Yellow
Write-Host ""

Write-Host "=== TOP 20 LARGEST PACKAGES (User Data) ===" -ForegroundColor Green
$results | Sort-Object SizeMB -Descending | Select-Object -First 20 | Format-Table PackageName, SizeMB, SizeGB -AutoSize

# Categorize packages
Write-Host ""
Write-Host "=== PACKAGE CATEGORIES ===" -ForegroundColor Green
Write-Host ""

# User-installed (likely removable) - Non-Microsoft third party
$thirdParty = @('CanonicalGroupLimited', 'SpotifyAB', 'OpenAI', 'NVIDIACorp', 'Realtek', '5319275A', 'WinRAR', 'Clipchamp', 'PythonSoftwareFoundation', '21676OptimiliaStudios')
$removableUserApps = @('Microsoft.MixedReality.Portal', 'Microsoft.XboxApp', 'Microsoft.SkypeApp', 'Microsoft.BingNews', 'Microsoft.BingWeather', 'Microsoft.MicrosoftSolitaireCollection', 'Microsoft.Microsoft3DViewer', 'Microsoft.Office.OneNote', 'Microsoft.Todos', 'Microsoft.People', 'Microsoft.GetHelp', 'Microsoft.ZuneVideo', 'Microsoft.ZuneMusic', 'Microsoft.WindowsFeedbackHub', 'Microsoft.YourPhone', 'Microsoft.PowerAutomateDesktop', 'Microsoft.Copilot')

Write-Host "THIRD-PARTY APPS (User-Installed, Can Remove):" -ForegroundColor Yellow
$thirdPartyTotal = 0
foreach ($pkg in $results) {
    foreach ($prefix in $thirdParty) {
        if ($pkg.PackageName -like "$prefix*") {
            Write-Host "  - $($pkg.PackageName): $($pkg.SizeMB) MB ($($pkg.SizeGB) GB)" -ForegroundColor White
            $thirdPartyTotal += $pkg.SizeMB
        }
    }
}
Write-Host "  SUBTOTAL: $([math]::Round($thirdPartyTotal/1024, 2)) GB" -ForegroundColor Cyan
Write-Host ""

Write-Host "MICROSOFT OPTIONAL APPS (Can Typically Remove):" -ForegroundColor Yellow
$msOptionalTotal = 0
foreach ($pkg in $results) {
    $baseName = $pkg.PackageName -replace '_.*$', ''
    if ($baseName -in $removableUserApps -and $pkg.SizeMB -gt 5) {
        Write-Host "  - $($pkg.PackageName): $($pkg.SizeMB) MB" -ForegroundColor White
        $msOptionalTotal += $pkg.SizeMB
    }
}
Write-Host "  SUBTOTAL: $([math]::Round($msOptionalTotal/1024, 2)) GB" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== RECOMMENDED ACTIONS ===" -ForegroundColor Magenta
Write-Host ""
Write-Host "Based on analysis, here are the LARGEST items that could be removed:" -ForegroundColor White
Write-Host ""
