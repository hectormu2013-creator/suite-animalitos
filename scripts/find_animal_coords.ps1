Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "--- Buscando centros de circulos de animales en fila 0 (Y=245) ---"
# Escaneamos horizontalmente de X=200 a X=800 a la altura de la primera fila
for ($x = 220; $x -lt 850; $x += 5) {
    $c = $bmp.GetPixel($x, 245)
    # Detectar el verde brillante de Ballena (00) y Delfin (0)
    # Verde: G alto (> 150), R bajo (< 50)
    if ($c.G -gt 150 -and $c.R -lt 80 -and $c.B -lt 80) {
        Write-Output "Verde detectado en X=$x (R:$($c.R), G:$($c.G), B:$($c.B))"
    }
}

$bmp.Dispose()
