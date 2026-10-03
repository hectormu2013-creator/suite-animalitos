Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

# Recortar panel completo del medio X de 240 a 600, Y de 650 a 864
$rectMid = New-Object System.Drawing.Rectangle 240, 650, 350, 214
$cropMid = $bmp.Clone($rectMid, $bmp.PixelFormat)
$cropMid.Save((Join-Path $PSScriptRoot "..\crop_guacharo_bottom_panel.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropMid.Dispose()

$bmp.Dispose()
Write-Output "Recorte de fondo guardado."
