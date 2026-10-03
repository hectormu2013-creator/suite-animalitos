Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

# Lista de loterías en X=10 a X=235, Y=145 a Y=480
# Recortar cada fila de 27px y guardarla para confirmar
for ($i = 0; $i -lt 12; $i++) {
    $y = 152 + ($i * 26)
    $rect = New-Object System.Drawing.Rectangle 15, $y, 220, 26
    $crop = $bmp.Clone($rect, $bmp.PixelFormat)
    $crop.Save((Join-Path $PSScriptRoot "..\crop_loteria_$i.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()
    Write-Output "Fila $i guardada en Y=$y"
}

$bmp.Dispose()
