Add-Type -AssemblyName System.Drawing
Get-ChildItem -Path "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded" -Filter "*.png" | ForEach-Object {
    $b = [System.Drawing.Bitmap]::FromFile($_.FullName)
    Write-Host "$($_.Name): $($b.Width) x $($b.Height)"
    $b.Dispose()
}
