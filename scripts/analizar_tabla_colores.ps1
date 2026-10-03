Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "=== ANALISIS DE COLORES EN LA TABLA DE PREMIER ==="

# La columna Num esta en X ≈ 940 (logico) -> Cursor X ≈ 752
# La columna Nombre en X ≈ 1080 (logico)
# El fondo naranja de las filas de la tabla:
# En la captura, el naranja es R ≈ 255, G ≈ 165..190, B ≈ 0..50
# El rojo es R ≈ 240..255, G < 60, B < 60

$naranjas = @()
$rojos = @()

# Recorremos verticalmente la columna Nombre/Monto en X=1080 desde Y=145 hasta Y=840 en saltos de 18px (altura aproximada de fila)
for ($y = 145; $y -lt 850; $y += 18) {
    $c = $bmp.GetPixel(1080, $y)
    
    # Naranja: R alto (>200), G medio (120..210), B bajo (<80)
    $isOrange = ($c.R -gt 210 -and $c.G -gt 130 -and $c.G -lt 215 -and $c.B -lt 80)
    # Rojo: R alto (>200), G bajo (<70), B bajo (<70)
    $isRed = ($c.R -gt 200 -and $c.G -lt 70 -and $c.B -lt 70)

    if ($isRed) {
        Write-Output "Fila ROJA (Agotado 0 Bs) en Y=$y (R:$($c.R), G:$($c.G), B:$($c.B))"
        $rojos += $y
    } elseif ($isOrange) {
        Write-Output "Fila NARANJA (Cupo reducido) en Y=$y (R:$($c.R), G:$($c.G), B:$($c.B))"
        $naranjas += $y
    }
}

Write-Output "`nTotal filas rojas detectadas: $($rojos.Count)"
Write-Output "Total filas naranjas detectadas: $($naranjas.Count)"

$bmp.Dispose()
