Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791137300957.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
Write-Output "Image Dimensions: $($bmp.Width) x $($bmp.Height)"

$rect = New-Object System.Drawing.Rectangle 40, 40, 360, 60
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
$cropPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_sorteos.png"
$crop.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$bmp.Dispose()
Write-Output "Saved crop to $cropPath"
