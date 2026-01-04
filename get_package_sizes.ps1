$packagesPath = 'C:\Users\Trey\AppData\Local\Packages'
$results = @()

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
        Name = $folderName
        SizeMB = [math]::Round($size / 1MB, 2)
        SizeGB = [math]::Round($size / 1GB, 2)
    }
}

$results | Sort-Object SizeMB -Descending | Select-Object -First 50 | Format-Table Name, SizeMB, SizeGB -AutoSize
