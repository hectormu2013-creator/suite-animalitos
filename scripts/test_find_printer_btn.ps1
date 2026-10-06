Add-Type -AssemblyName System.Drawing

function FindPrinterButton($bmp, $startX = 0, $startY = 0) {
    $bluePoints = @()
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.R -lt 40 -and $p.G -gt 130 -and $p.B -gt 210) {
                $bluePoints += [PSCustomObject]@{ X = $x; Y = $y }
            }
        }
    }
    if ($bluePoints.Count -eq 0) { return $null }
    
    # Encontrar el primer botón (el más a la izquierda de la barra superior)
    $minX = ($bluePoints | Measure-Object -Property X -Minimum).Minimum
    $btn1 = $bluePoints | Where-Object { $_.X -ge $minX -and $_.X -le ($minX + 45) }
    
    $avgX = [int](($btn1 | Measure-Object -Property X -Average).Average)
    $avgY = [int](($btn1 | Measure-Object -Property Y -Average).Average)
    
    return [PSCustomObject]@{
        X = $startX + $avgX
        Y = $startY + $avgY
        Pixels = $btn1.Count
    }
}

$b = [System.Drawing.Bitmap]::FromFile((Resolve-Path "$PSScriptRoot/../crop_buttons.png").Path)
$res = FindPrinterButton $b 1100 40
Write-Output "Boton impresora detectado en: X=$($res.X), Y=$($res.Y) (Pixeles=$($res.Pixels))"
$b.Dispose()
