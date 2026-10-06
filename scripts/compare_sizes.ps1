Add-Type -AssemblyName System.Drawing
$b1 = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791140831719.png")
Write-Host "Old: $($b1.Width) x $($b1.Height)"
$b1.Dispose()

$b2 = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791151740065.png")
Write-Host "New: $($b2.Width) x $($b2.Height)"
$b2.Dispose()
