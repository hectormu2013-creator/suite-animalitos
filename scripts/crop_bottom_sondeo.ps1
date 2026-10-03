Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

$rectMid = New-Object System.Drawing.Rectangle 240, 680, 350, 180
$cropMid = $bmp.Clone($rectMid, $bmp.PixelFormat)
$cropMid.Save((Join-Path $PSScriptRoot "..\crop_bottom_rows_sondeo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropMid.Dispose()

$bmp.Dispose()
Write-Output "Recorte de filas inferiores guardado."
