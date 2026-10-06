Add-Type -AssemblyName System.Drawing
$imgPath = Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png"
if (-not (Test-Path $imgPath)) {
    Write-Host "No existe $imgPath"
    exit
}
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
Write-Host "Image size: $($bmp.Width) x $($bmp.Height)"

# Row 1 is Ballena at roughly Y=160
# Let's inspect where the columns are:
# Num, Nombre, Monto, Sorteo
$y = 160
Write-Host "`nScanning horizontal strip at Y=$y across table (X=700 to 1450):"
for ($x = 700; $x -le 1450; $x += 20) {
    $p = $bmp.GetPixel($x, $y)
    Write-Host "X=$x : R=$($p.R), G=$($p.G), B=$($p.B)"
}
$bmp.Dispose()
