Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "--- Buscando barra azul seleccionada en columna X=100 ---"
$foundStart = -1
$foundEnd = -1
for ($y = 100; $y -lt 500; $y++) {
    $c = $bmp.GetPixel(100, $y)
    # Azul oscuro del seleccionado es R:0, G:120, B:215 aprox
    if ($c.B -gt 180 -and $c.R -lt 50 -and $c.G -lt 150) {
        if ($foundStart -eq -1) { $foundStart = $y }
        $foundEnd = $y
    }
}

Write-Output "Barra azul seleccionada detectada desde Y=$foundStart hasta Y=$foundEnd (Centro: $(($foundStart + $foundEnd)/2))"
$bmp.Dispose()
