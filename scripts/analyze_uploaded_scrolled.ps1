Add-Type -AssemblyName System.Drawing
$f = "C:\Users\Hector\.gemini\antigravity-ide\brain\a3f59459-faef-46c8-b6ef-c95ddd138044\.user_uploaded\media_1790956196704.png"
$b = [System.Drawing.Bitmap]::FromFile($f)
Write-Output "Uploaded image size: $($b.Width) x $($b.Height)"
$b.Dispose()
