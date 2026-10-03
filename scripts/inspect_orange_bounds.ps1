Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path (Join-Path $PSScriptRoot "..\crop_table_test.png")).Path)

Write-Output "Image size: $($bmp.Width) x $($bmp.Height)"

# Let's inspect along Y=35 (Row 1: Elefant), Y=63 (Row 2: Venado), etc.
$testYs = @(35, 63, 90, 118, 145, 173, 201, 229)

for ($i = 0; $i -lt $testYs.Count; $i++) {
    $y = $testYs[$i]
    # Scan X across the row to find background color
    $orangeXs = @()
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -gt 200 -and $c.G -gt 130 -and $c.G -lt 220 -and $c.B -lt 80) {
            $orangeXs += $x
        }
    }
    if ($orangeXs.Count -gt 0) {
        Write-Output "Row $i at Y=$($y) - Orange found between X=$($orangeXs[0]) and X=$($orangeXs[-1]) (Count: $($orangeXs.Count))"
    } else {
        Write-Output "Row $i at Y=$($y) - NO orange found!"
    }
}
$bmp.Dispose()
