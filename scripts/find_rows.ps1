Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "--- Escaneando filas en Columna 0 (X=440) ---"
# Ballena(00)=verde, Leon(5)=rojo, Gato(11)=negro, Pavo(17)=negro, Zebra(23)=rojo, Elefante(29)=negro, Jirafa(35)=negro, Canguro(41)=negro
for ($y = 200; $y -lt 850; $y += 5) {
    $c = $bmp.GetPixel(440, $y)
    # Detectar circulos
    $isRed = ($c.R -gt 150 -and $c.G -lt 60 -and $c.B -lt 60)
    $isGreen = ($c.G -gt 130 -and $c.R -lt 80 -and $c.B -lt 80)
    if ($isRed -or $isGreen) {
        Write-Output "Fila con color detectado en Y=$y (R:$($c.R), G:$($c.G), B:$($c.B))"
    }
}

$bmp.Dispose()
