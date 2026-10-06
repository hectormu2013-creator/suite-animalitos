Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/../crop_buttons.png")

for ($x = 100; $x -le 250; $x += 10) {
    $p = $b.GetPixel($x, 28)
    Write-Output "x=$x (Abs: $(1100+$x)), y=28 -> R=$($p.R) G=$($p.G) B=$($p.B)"
}
$b.Dispose()
