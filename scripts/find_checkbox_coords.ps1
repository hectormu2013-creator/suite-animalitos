Add-Type -AssemblyName System.Drawing

$img = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791137300957.png"
$bmp = [System.Drawing.Bitmap]::FromFile($img)

Write-Output "Image size: $($bmp.Width) x $($bmp.Height)"

# In Image 1, the top text 'Tickets Operaciones Juegos Opciones' is near Y=15
# Under that, 'Sorteos: (GUACHARITO MILLONARIO)' is near Y=45
# Checkboxes are near Y=70..85
# Let's search for the first checkbox square in Y=50..100, X=20..300
for ($y = 55; $y -le 95; $y += 2) {
    for ($x = 40; $x -le 250; $x += 2) {
        $px = $bmp.GetPixel($x, $y)
        # Checkbox border is dark/gray, inside is white
        if ($px.R -lt 60 -and $px.G -lt 60 -and $px.B -lt 60) {
            $inner = $bmp.GetPixel($x + 4, $y + 4)
            if ($inner.R -gt 240 -and $inner.G -gt 240 -and $inner.B -gt 240) {
                Write-Output "Found checkbox corner at X=$x, Y=$y (Inner color: $($inner.R),$($inner.G),$($inner.B))"
            }
        }
    }
}

$bmp.Dispose()
