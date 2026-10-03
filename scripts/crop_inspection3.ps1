Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

$rectRight = New-Object System.Drawing.Rectangle 1100, 40, 430, 80
$cropRight = $bmp.Clone($rectRight, $bmp.PixelFormat)
$cropRight.Save((Join-Path $PSScriptRoot "..\crop_buttons.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropRight.Dispose()

$bmp.Dispose()
Write-Output "Recorte de botones listo."
