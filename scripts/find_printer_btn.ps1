Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/../premier_pantalla_calibrada.png")
Write-Output "Image Size: $($img.Width)x$($img.Height)"

$bluePoints = @()
for ($x = 900; $x -lt 1400; $x += 2) {
    for ($y = 45; $y -lt 85; $y += 2) {
        $px = $img.GetPixel($x, $y)
        # Celeste de los botones: R alrededor de 0-50, G alrededor de 140-180, B alrededor de 220-255
        if ($px.B -gt 180 -and $px.R -lt 80 -and $px.G -gt 100) {
            $bluePoints += [PSCustomObject]@{ X = $x; Y = $y; R = $px.R; G = $px.G; B = $px.B }
        }
    }
}

Write-Output "Found $($bluePoints.Count) blue pixels."
# Agrupar por bloques continuos en X
$groups = @()
$currentGroup = @()
$lastX = -999
foreach ($p in ($bluePoints | Sort-Object X)) {
    if ($p.X - $lastX -gt 5) {
        if ($currentGroup.Count -gt 0) { $groups += ,@($currentGroup) }
        $currentGroup = @($p)
    } else {
        $currentGroup += $p
    }
    $lastX = $p.X
}
if ($currentGroup.Count -gt 0) { $groups += ,@($currentGroup) }

Write-Output "Botones detectados: $($groups.Count)"
$btnIndex = 1
foreach ($grp in $groups) {
    $minX = ($grp | Measure-Object -Property X -Minimum).Minimum
    $maxX = ($grp | Measure-Object -Property X -Maximum).Maximum
    $minY = ($grp | Measure-Object -Property Y -Minimum).Minimum
    $maxY = ($grp | Measure-Object -Property Y -Maximum).Maximum
    $centerX = [int](($minX + $maxX) / 2)
    $centerY = [int](($minY + $maxY) / 2)
    Write-Output "Boton $btnIndex : X=[$minX..$maxX] (Centro: $centerX), Y=[$minY..$maxY] (Centro: $centerY), Ancho=$($maxX-$minX), Alto=$($maxY-$minY)"
    $btnIndex++
}
$img.Dispose()
