Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png")

$cropRect = New-Object System.Drawing.Rectangle 10, 130, 240, 340
$crop = $bmp.Clone($cropRect, $bmp.PixelFormat)
$g = [System.Drawing.Graphics]::FromImage($crop)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Lime, 2)
$font = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Lime)

$targets = @(
    @{ Name = "LA GRANJITA";           Y = 204 },
    @{ Name = "GUACHARITO MILLONARIO"; Y = 314 },
    @{ Name = "GUACHARO ACTIVO";       Y = 342 },
    @{ Name = "LOTTO ACTIVO";          Y = 369 },
    @{ Name = "SELVA PLUS";            Y = 452 }
)

foreach ($t in $targets) {
    $yLocal = $t.Y - 130
    $g.DrawLine($pen, 10, $yLocal, 230, $yLocal)
    $g.DrawString(">>> " + $t.Name + " (Y=" + $t.Y + ")", $font, $brush, 15, ($yLocal - 14))
}

$g.Dispose()
$pen.Dispose()
$font.Dispose()
$brush.Dispose()

$crop.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_final_exact_calibrated.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$bmp.Dispose()
Write-Host "Saved crop_final_exact_calibrated.png"
