Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/../crop_buttons.png")

# Encontrar todas las columnas que contienen el azul #009EF7
$blueXs = @()
for ($x = 0; $x -lt $b.Width; $x++) {
    for ($y = 0; $y -lt $b.Height; $y++) {
        $p = $b.GetPixel($x, $y)
        if ($p.R -lt 20 -and $p.G -gt 140 -and $p.B -gt 230) {
            $blueXs += $x
            break
        }
    }
}

# Agrupar las columnas contiguas
$btnRanges = @()
$start = $blueXs[0]
$prev = $blueXs[0]
foreach ($x in $blueXs[1..($blueXs.Count-1)]) {
    if ($x - $prev -gt 2) {
        $btnRanges += [PSCustomObject]@{ Start = $start; End = $prev; Width = ($prev - $start + 1); AbsCenter = (1100 + [int](($start+$prev)/2)) }
        $start = $x
    }
    $prev = $x
}
$btnRanges += [PSCustomObject]@{ Start = $start; End = $prev; Width = ($prev - $start + 1); AbsCenter = (1100 + [int](($start+$prev)/2)) }

Write-Output "Botones azules encontrados en crop_buttons:"
$i = 1
foreach ($r in $btnRanges) {
    Write-Output "Boton $i : Rel=[$($r.Start)..$($r.End)], Ancho=$($r.Width), AbsCenter=$($r.AbsCenter)"
    $i++
}
$b.Dispose()
