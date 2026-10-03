Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile((Resolve-Path (Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png")).Path)

# Columna 0 de animales en 1536x864: X ≈ 270 (en DPI 1.25 -> Cursor X ≈ 216)
# Midpoints reales de los botones en la pantalla de 1536x864:
# En premier_tabla_sondeo.png, busquemos los bordes superiores e inferiores de cada fila de animales
Write-Output "=== DETECCION DE FILAS DE ANIMALES EN premier_tabla_sondeo.png ==="

# Escaneamos verticalmente en X=440 (Columna 0 de animales)
$inCircle = $false
$circleStart = 0
$rows = @()

for ($y = 120; $y -lt 850; $y++) {
    $c = $b.GetPixel(440, $y)
    $isWhite = ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240)
    
    if (-not $isWhite -and -not $inCircle) {
        $inCircle = $true
        $circleStart = $y
    } elseif ($isWhite -and $inCircle) {
        $inCircle = $false
        $circleEnd = $y
        $height = $circleEnd - $circleStart
        if ($height -gt 35) {
            $midY = [int](($circleStart + $circleEnd) / 2)
            # Convertir a cursor DPI 1.25
            $cursorY = [int]($midY / 1.25)
            $rows += [PSCustomObject]@{
                GlobalY = $midY
                CursorY = $cursorY
                Height = $height
            }
        }
    }
}

$b.Dispose()

$idx = 0
foreach ($r in $rows) {
    Write-Output "Fila $idx : GlobalY = $($r.GlobalY), CursorY = $($r.CursorY), Altura = $($r.Height) px"
    $idx++
}
