Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile((Resolve-Path "$PSScriptRoot/../premier_tabla_sondeo.png").Path)

$greenPoints = @()
for ($y = 40; $y -lt 100; $y++) {
    for ($x = 180; $x -lt 800; $x++) {
        $c = $b.GetPixel($x, $y)
        if ($c.G -gt 130 -and $c.G -gt ($c.R + 40) -and $c.G -gt ($c.B + 40)) {
            $greenPoints += [PSCustomObject]@{ X = $x; Y = $y }
        }
    }
}
Write-Output "Total green pixels in 180..800: $($greenPoints.Count)"
if ($greenPoints.Count -gt 0) {
    $avgX = [int](($greenPoints | Measure-Object -Property X -Average).Average)
    $avgY = [int](($greenPoints | Measure-Object -Property Y -Average).Average)
    Write-Output "Green center: X=$avgX, Y=$avgY"
}
$b.Dispose()
