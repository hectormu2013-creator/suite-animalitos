Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "Dimensiones de la imagen: $($bmp.Width) x $($bmp.Height)"

# Recortar panel completo del medio (X de 210 a 505, Y de 180 a 860)
$rectGrid = New-Object System.Drawing.Rectangle 210, 180, 295, 680
$cropGrid = $bmp.Clone($rectGrid, $bmp.PixelFormat)
$cropGrid.Save((Join-Path $PSScriptRoot "..\crop_guacharo_grid.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropGrid.Dispose()

# Recortar parte inferior del grid para ver si hay scrollbar o mas animales (X de 210 a 510, Y de 650 a 860)
$rectBottomGrid = New-Object System.Drawing.Rectangle 210, 650, 300, 210
$cropBottomGrid = $bmp.Clone($rectBottomGrid, $bmp.PixelFormat)
$cropBottomGrid.Save((Join-Path $PSScriptRoot "..\crop_guacharo_bottom.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropBottomGrid.Dispose()

# Recortar barra de sorteos (X de 215 a 500, Y de 40 a 115)
$rectSorteos = New-Object System.Drawing.Rectangle 215, 40, 290, 75
$cropSorteos = $bmp.Clone($rectSorteos, $bmp.PixelFormat)
$cropSorteos.Save((Join-Path $PSScriptRoot "..\crop_guacharo_sorteos.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropSorteos.Dispose()

$bmp.Dispose()
Write-Output "Recortes de Guacharo guardados con exito."
