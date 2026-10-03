Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

$rectMid = New-Object System.Drawing.Rectangle 240, 150, 340, 710
$cropMid = $bmp.Clone($rectMid, $bmp.PixelFormat)
$cropMid.Save((Join-Path $PSScriptRoot "..\crop_guacharo_mid_panel.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropMid.Dispose()

$bmp.Dispose()
Write-Output "Recorte de panel central guardado."
