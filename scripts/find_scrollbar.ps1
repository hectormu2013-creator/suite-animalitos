Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

# Escanear entre el final del panel de animales y el inicio de la tabla (X de 870 a 920, Y de 180 a 860)
$rectScroll = New-Object System.Drawing.Rectangle 870, 180, 50, 680
$cropScroll = $bmp.Clone($rectScroll, $bmp.PixelFormat)
$cropScroll.Save((Join-Path $PSScriptRoot "..\crop_real_scrollbar.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropScroll.Dispose()

$bmp.Dispose()
Write-Output "Recorte de scrollbar real guardado."
