Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

# Vamos a recortar regiones clave para verlas:
# 1. Lista de loterías
$rectLoterias = New-Object System.Drawing.Rectangle 10, 140, 230, 350
$cropLoterias = $bmp.Clone($rectLoterias, $bmp.PixelFormat)
$cropLoterias.Save((Join-Path $PSScriptRoot "..\crop_loterias.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropLoterias.Dispose()

# 2. Barra de acciones / inputs
$rectInputs = New-Object System.Drawing.Rectangle 580, 50, 350, 70
$cropInputs = $bmp.Clone($rectInputs, $bmp.PixelFormat)
$cropInputs.Save((Join-Path $PSScriptRoot "..\crop_inputs.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropInputs.Dispose()

# 3. Barra de sorteos
$rectSorteos = New-Object System.Drawing.Rectangle 245, 50, 340, 70
$cropSorteos = $bmp.Clone($rectSorteos, $bmp.PixelFormat)
$cropSorteos.Save((Join-Path $PSScriptRoot "..\crop_sorteos.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropSorteos.Dispose()

Write-Output "Recortes guardados con exito."
$bmp.Dispose()
