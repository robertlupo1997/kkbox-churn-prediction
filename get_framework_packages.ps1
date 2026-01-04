# Get framework packages (dependencies that other apps use)
Write-Host "=== FRAMEWORK PACKAGES (Required by other apps) ===" -ForegroundColor Yellow
Get-AppxPackage | Where-Object { $_.IsFramework -eq $true } | Select-Object Name | Sort-Object Name | Format-Table -AutoSize
