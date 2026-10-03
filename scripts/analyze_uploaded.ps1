Add-Type -AssemblyName System.Drawing

$imgFile = "C:\Users\Hector\.gemini\antigravity-ide\brain\74a0f376-06d9-4223-bb37-11a143fd80c0\.user_uploaded\media_1790894090974.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)
Write-Output "Uploaded image size: $($bmp.Width) x $($bmp.Height)"

# Encontrar el checkbox negro en la esquina superior izquierda del panel de sorteos
# Buscamos el borde del checkbox:
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # Borde negro del checkbox
        if ($c.R -lt 25 -and $c.G -lt 25 -and $c.B -lt 25) {
            # Si adentro a la derecha y abajo hay blanco (interior de la casilla)
            if ($x + 8 -lt $bmp.Width -and $y + 8 -lt $bmp.Height) {
                $cInside = $bmp.GetPixel($x + 6, $y + 6)
                if ($cInside.R -gt 240 -and $cInside.G -gt 240 -and $cInside.B -gt 240) {
                    Write-Output "Checkbox encontrado en imagen subida: X=$x, Y=$y"
                    $boxX = $x
                    $boxY = $y
                    break
                }
            }
        }
    }
    if ($boxX) { break }
}

# Tambien encontrar donde empieza el panel azul 'Sorteos: (GUACHARO ACTIVO)'
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # Azul del banner
        if ($c.B -gt 180 -and $c.R -lt 40) {
            Write-Output "Banner azul empieza en imagen subida en X=$x, Y=$y"
            break
        }
    }
    if ($c.B -gt 180 -and $c.R -lt 40) { break }
}

$bmp.Dispose()
