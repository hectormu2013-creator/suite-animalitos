Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png")

# Let's draw horizontal lines and text on the crop to see the exact screen Y coordinates:
$cropRect = New-Object System.Drawing.Rectangle 10, 100, 240, 320
$cropBmp = $bmp.Clone($cropRect, $bmp.PixelFormat)
$g = [System.Drawing.Graphics]::FromImage($cropBmp)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 1)
$penGreen = New-Object System.Drawing.Pen([System.Drawing.Color]::LimeGreen, 1)
$font = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Yellow)
$brushGreen = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::LimeGreen)

# In premier_pantalla_calibrada.png:
# Row 0 (RICACHONA header): Y=115
# Let's inspect rows:
# Let's draw lines from screen Y=110 to Y=400 in steps of 5, or inspect the stripe background color:
for ($screenY = 110; $screenY -lt 400; $screenY++) {
    $c = $bmp.GetPixel(30, $screenY)
}

# In premier_pantalla_calibrada, let's test specific Y values:
# Row 0: ANIMALITOS LA RICACHONA -> ~118
# Row 1: GRANJITA PLUS -> ~143
# Row 2: LA GRANJITA -> ~168
# Row 3: CENTENA ANIMALITOS -> ~193
# Row 4: CENTENA PLUS -> ~218
# Row 5: CHANCE ANIMAL A -> ~243
# Row 6: GUACHARITO MILLONARIO -> ~268
# Row 7: GUACHARO ACTIVO -> ~293
# Row 8: LOTTO ACTIVO -> ~318
# Row 9: LOTTO ACTIVO INT. -> ~343
# Row 10: MEGA ANIMAL 40 -> ~368
# Row 11: SELVA PLUS -> ~393

$testRows = @(
    @{ Name = "LA RICACHONA";         Y = 118 },
    @{ Name = "GRANJITA PLUS";        Y = 143 },
    @{ Name = "LA GRANJITA";          Y = 168 },
    @{ Name = "CENTENA ANIMALITOS";   Y = 193 },
    @{ Name = "CENTENA PLUS";         Y = 218 },
    @{ Name = "CHANCE ANIMAL A";      Y = 243 },
    @{ Name = "GUACHARITO MILLONARIO";Y = 268 },
    @{ Name = "GUACHARO ACTIVO";      Y = 293 },
    @{ Name = "LOTTO ACTIVO";         Y = 318 },
    @{ Name = "LOTTO ACTIVO INT.";    Y = 343 },
    @{ Name = "MEGA ANIMAL 40";       Y = 368 },
    @{ Name = "SELVA PLUS";           Y = 393 }
)

foreach ($r in $testRows) {
    $localY = $r.Y - 100
    if ($localY -ge 0 -and $localY -lt 320) {
        $g.DrawLine($pen, 0, $localY, 240, $localY)
        $txt = "$($r.Name): Y=$($r.Y)"
        $g.DrawString($txt, $font, $brush, 5, ($localY - 10))
    }
}

$pen.Dispose()
$penGreen.Dispose()
$font.Dispose()
$brush.Dispose()
$brushGreen.Dispose()
$g.Dispose()

$cropBmp.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_verified_calibrated.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropBmp.Dispose()
$bmp.Dispose()
Write-Host "Saved crop_verified_calibrated.png"
