Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png")

# Let's test exact centers:
# Let's crop 240x22 boxes at the centers we calculated:
$loterias = @(
    @{ Name = "ANIMALITOS LA RICACHONA"; Y = 143 },
    @{ Name = "GRANJITA PLUS";           Y = 168 },
    @{ Name = "LA GRANJITA";             Y = 193 },
    @{ Name = "CENTENA ANIMALITOS";      Y = 218 },
    @{ Name = "CENTENA PLUS";            Y = 243 },
    @{ Name = "CHANCE ANIMAL A";         Y = 268 },
    @{ Name = "GUACHARITO MILLONARIO";   Y = 293 },
    @{ Name = "GUACHARO ACTIVO";         Y = 318 },
    @{ Name = "LOTTO ACTIVO";            Y = 343 },
    @{ Name = "LOTTO ACTIVO INT";        Y = 368 },
    @{ Name = "MEGA ANIMAL 40";          Y = 393 },
    @{ Name = "SELVA PLUS";              Y = 418 }
)

$combined = New-Object System.Drawing.Bitmap 240, ($loterias.Count * 25)
$g = [System.Drawing.Graphics]::FromImage($combined)
$font = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Red)

for ($i = 0; $i -lt $loterias.Count; $i++) {
    $item = $loterias[$i]
    $srcRect = New-Object System.Drawing.Rectangle 10, ($item.Y - 12), 240, 24
    $destRect = New-Object System.Drawing.Rectangle 0, ($i * 25), 240, 24
    $g.DrawImage($bmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString("Y=" + $item.Y, $font, $brush, 2, ($i * 25 + 4))
}

$g.Dispose()
$font.Dispose()
$brush.Dispose()

$outPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_all_calibrated_boxes.png"
$combined.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$combined.Dispose()
$bmp.Dispose()
Write-Host "Saved crop_all_calibrated_boxes.png"
