Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/../crop_buttons.png")
Write-Output "crop_buttons.png: $($b.Width)x$($b.Height)"

# Encontrar los píxeles celestes de los botones
# Recordemos que el crop fue tomado en X=1100, Y=40
$blueCols = @()
for ($x = 0; $x -lt $b.Width; $x++) {
    for ($y = 0; $y -lt $b.Height; $y++) {
        $p = $b.GetPixel($x, $y)
        if ($p.B -gt 200 -and $p.R -lt 50) {
            $blueCols += $x
            break
        }
    }
}

$minX = ($blueCols | Measure-Object -Minimum).Minimum
$maxX = ($blueCols | Measure-Object -Maximum).Maximum
Write-Output "Blue area in crop: X from $minX to $maxX"

# Buscar los 3 botones (Imprimir, +, Bs)
# En crop_buttons.png, el primer botón azul es la Impresora!
# Vamos a encontrar el centro del primer botón azul
$btn1Pixels = @()
for ($x = 0; $x -lt 250; $x++) {
    for ($y = 0; $y -lt $b.Height; $y++) {
        $p = $b.GetPixel($x, $y)
        if ($p.B -gt 200 -and $p.R -lt 50) {
            $btn1Pixels += [PSCustomObject]@{ X = $x; Y = $y }
        }
    }
}

# Agrupar el primer botón
$b1Xmin = ($btn1Pixels | Measure-Object -Property X -Minimum).Minimum
$b1Xmax = ($btn1Pixels | Where-Object { $_.X -lt ($b1Xmin + 60) } | Measure-Object -Property X -Maximum).Maximum
$b1Ymin = ($btn1Pixels | Where-Object { $_.X -le $b1Xmax } | Measure-Object -Property Y -Minimum).Minimum
$b1Ymax = ($btn1Pixels | Where-Object { $_.X -le $b1Xmax } | Measure-Object -Property Y -Maximum).Maximum

$relCenterX = [int](($b1Xmin + $b1Xmax) / 2)
$relCenterY = [int](($b1Ymin + $b1Ymax) / 2)

$absCenterX = 1100 + $relCenterX
$absCenterY = 40 + $relCenterY

Write-Output "Boton Impresora en crop: X=[$b1Xmin..$b1Xmax] (Centro Rel: $relCenterX), Y=[$b1Ymin..$b1Ymax] (Centro Rel: $relCenterY)"
Write-Output "COORDENADA ABSOLUTA DE LA IMPRESORA: X=$absCenterX, Y=$absCenterY"
$b.Dispose()
