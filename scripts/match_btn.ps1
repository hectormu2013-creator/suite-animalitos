Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/../crop_top_right_buttons.png")
Write-Output "crop_top_right_buttons.png: $($b.Width)x$($b.Height)"
$full = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/../premier_pantalla_calibrada.png")

# Template match crop_top_right_buttons in full
$foundX = -1
$foundY = -1
$firstPix = $b.GetPixel(5, 5)

for ($y = 0; $y -lt 150; $y++) {
    for ($x = 800; $x -lt 1500; $x++) {
        $match = $true
        for ($cy = 0; $cy -lt $b.Height; $cy += 4) {
            for ($cx = 0; $cx -lt $b.Width; $cx += 8) {
                $p1 = $b.GetPixel($cx, $cy)
                $p2 = $full.GetPixel($x + $cx, $y + $cy)
                if ([Math]::Abs($p1.R - $p2.R) -gt 15 -or [Math]::Abs($p1.G - $p2.G) -gt 15 -or [Math]::Abs($p1.B - $p2.B) -gt 15) {
                    $match = $false
                    break
                }
            }
            if (-not $match) { break }
        }
        if ($match) {
            $foundX = $x
            $foundY = $y
            break
        }
    }
    if ($foundX -ge 0) { break }
}

Write-Output "Found crop at X=$foundX, Y=$foundY in premier_pantalla_calibrada.png"
$b.Dispose()
$full.Dispose()
