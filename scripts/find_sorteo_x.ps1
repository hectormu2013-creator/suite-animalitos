Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\crop_guacharo_sorteos.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "--- Buscando casillas y letras de atajos en sorteos ---"
# En Y=80 global (Y=40 en crop):
for ($x = 100; $x -lt 280; $x += 2) {
    $c = $bmp.GetPixel($x, 40)
    if ($c.R -lt 50 -and $c.G -lt 50 -and $c.B -lt 50) {
        $gx = 215 + $x
        Write-Output "Borde negro en Crop X=$x -> Global Logico X=$gx -> Cursor 125% X=$([math]::Round($gx/1.25))"
    }
}
$bmp.Dispose()
