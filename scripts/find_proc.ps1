Get-Process | Where-Object { $_.ProcessName -match "premier|pluss" } | ForEach-Object {
    Write-Host "PID: $($_.Id), Name: $($_.ProcessName)"
}
