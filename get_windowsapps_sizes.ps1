# Get sizes of apps in WindowsApps folder (may need admin for full access)
$appsPath = 'C:\Program Files\WindowsApps'
$results = @()

try {
    Get-ChildItem -Path $appsPath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $folderPath = $_.FullName
        $folderName = $_.Name
        try {
            $size = (Get-ChildItem -Path $folderPath -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            if ($null -eq $size) { $size = 0 }
        } catch {
            $size = 0
        }
        $results += [PSCustomObject]@{
            Name = $folderName
            SizeMB = [math]::Round($size / 1MB, 2)
            SizeGB = [math]::Round($size / 1GB, 2)
        }
    }

    $results | Sort-Object SizeMB -Descending | Select-Object -First 40 | Format-Table Name, SizeMB, SizeGB -AutoSize
} catch {
    Write-Host "Error accessing WindowsApps folder - may need admin privileges"
}
