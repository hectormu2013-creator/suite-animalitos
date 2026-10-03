Add-Type -AssemblyName System.Drawing

$imgFile = "C:\Users\Hector\.gemini\antigravity-ide\brain\74a0f376-06d9-4223-bb37-11a143fd80c0\.user_uploaded\media_1790894090974.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

# Buscar el verde de Ballena (00)
for ($y = 100; $y -lt $bmp.Height; $y++) {
    for ($x = 150; $x -lt 250; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.G -gt 150 -and $c.R -lt 50 -and $c.B -lt 50) {
            Write-Output "Ballena verde encontrada en: X=$x, Y=$y"
            break
        }
    }
    if ($c.G -gt 150 -and $c.R -lt 50 -and $c.B -lt 50) { break }
}

$bmp.Dispose()
