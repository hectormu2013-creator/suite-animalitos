Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791138596697.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
Write-Output "Image Dimensions: $($bmp.Width) x $($bmp.Height)"

# Let's crop:
# 1. The top left corner with F2, F3, F4 tabs (0, 0, 150, 110)
$rectF = New-Object System.Drawing.Rectangle 0, 0, 150, 110
$cropF = $bmp.Clone($rectF, $bmp.PixelFormat)
$cropF.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_tabs_f2_f4.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropF.Dispose()

# 2. Sorteos checkboxes area (200, 30, 300, 60)
$rectS = New-Object System.Drawing.Rectangle 200, 30, 300, 60
$cropS = $bmp.Clone($rectS, $bmp.PixelFormat)
$cropS.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_sorteos_real.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropS.Dispose()

$bmp.Dispose()
Write-Output "Crops saved successfully!"
