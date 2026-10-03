Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile('C:\Users\Hector\.gemini\antigravity-ide\brain\74a0f376-06d9-4223-bb37-11a143fd80c0\.user_uploaded\media_1790895594467.png')
Write-Output "Size: $($b.Width) x $($b.Height)"
$b.Dispose()
