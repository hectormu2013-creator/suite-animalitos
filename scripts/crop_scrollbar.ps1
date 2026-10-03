Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

$rectScroll = New-Object System.Drawing.Rectangle 480, 150, 45, 710
$cropScroll = $bmp.Clone($rectScroll, $bmp.PixelFormat)
$cropScroll.Save((Join-Path $PSScriptRoot "..\crop_guacharo_scrollbar.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropScroll.Dispose()

$bmp.Dispose()
Write-Output "Recorte de scrollbar guardado."
