Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\crop_guacharo_sorteos.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)
Write-Output "Crop size: $($bmp.Width) x $($bmp.Height)"

# Encontrar donde esta el texto o casilla dentro de crop_guacharo_sorteos.png
for ($y = 0; $y -lt $bmp.Height; $y += 2) {
    for ($x = 0; $x -lt $bmp.Width; $x += 2) {
        $c = $bmp.GetPixel($x, $y)
        # Buscar pixel negro del texto o borde
        if ($c.R -lt 30 -and $c.G -lt 30 -and $c.B -lt 30) {
            # Logico global: X_global = 215 + $x, Y_global = 40 + $y
            $gx = 215 + $x
            $gy = 40 + $y
            Write-Output "Negro en Crop ($x, $y) -> Global Logico ($gx, $gy) -> Cursor ($([math]::Round($gx/1.25)), $([math]::Round($gy/1.25)))"
            break
        }
    }
}
$bmp.Dispose()
