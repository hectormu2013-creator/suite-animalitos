Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

$rectInputs = New-Object System.Drawing.Rectangle 580, 40, 600, 80
$cropInputs = $bmp.Clone($rectInputs, $bmp.PixelFormat)
$cropInputs.Save((Join-Path $PSScriptRoot "..\crop_inputs_wide.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropInputs.Dispose()

$rectBottom = New-Object System.Drawing.Rectangle 580, 750, 950, 110
$cropBottom = $bmp.Clone($rectBottom, $bmp.PixelFormat)
$cropBottom.Save((Join-Path $PSScriptRoot "..\crop_bottom.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropBottom.Dispose()

$bmp.Dispose()
Write-Output "Recortes adicionales listos."
