Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png")

$cropRect = New-Object System.Drawing.Rectangle 10, 380, 240, 80
$cropBmp = $bmp.Clone($cropRect, $bmp.PixelFormat)
$g = [System.Drawing.Graphics]::FromImage($cropBmp)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 1)
$font = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Yellow)

for ($y = 390; $y -le 450; $y += 10) {
    $localY = $y - 380
    $g.DrawLine($pen, 0, $localY, 240, $localY)
    $g.DrawString("Y=$y", $font, $brush, 5, ($localY - 10))
}

$g.Dispose()
$pen.Dispose()
$font.Dispose()
$brush.Dispose()

$cropBmp.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_bottom_rows.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropBmp.Dispose()
$bmp.Dispose()
Write-Host "Saved crop_bottom_rows.png"
