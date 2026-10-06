Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791125640895.png"
if (Test-Path $imgPath) {
    $bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
    Write-Output "Guacharo Screenshot Dimensions: $($bmp.Width) x $($bmp.Height)"
    # Crop the top area
    $rect = New-Object System.Drawing.Rectangle 0, 30, [Math]::Min(1200, $bmp.Width), 70
    $crop = $bmp.Clone($rect, $bmp.PixelFormat)
    $cropPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_guacharo_sorteos.png"
    $crop.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()
    $bmp.Dispose()
    Write-Output "Saved to $cropPath"
} else {
    Write-Output "Not found"
}
