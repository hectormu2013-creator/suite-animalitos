Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791151740065.png"
$bmp = New-Object System.Drawing.Bitmap $imgPath

# Check column X=20 (inside the list box)
$prevR = 0
$rows = @()
for ($y = 70; $y -lt 340; $y++) {
    $c = $bmp.GetPixel(30, $y)
    # Background alternating colors:
    # Row 0: White (255, 255, 255)
    # Row 1: Light blue (235, 241, 250) or similar
    # Border: (217, 217, 217) or darker
}

# Let's save a 1-pixel wide vertical strip from Y=75 to Y=335 expanded to 200px width so we can inspect it visually
$stripBmp = New-Object System.Drawing.Bitmap 300, 260
$g = [System.Drawing.Graphics]::FromImage($stripBmp)
$srcRect = New-Object System.Drawing.Rectangle(10, 75, 220, 260)
$destRect = New-Object System.Drawing.Rectangle(0, 0, 220, 260)
$g.DrawImage($bmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

# Overlay horizontal red lines at calculated centers:
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 1)
$font = New-Object System.Drawing.Font("Arial", 8)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Yellow)

# Row 11 is SELVA PLUS: center Y in original is 318 -> in strip is 318 - 75 = 243
# Height per row:
# From Row 0 to Row 11 is 11 steps.
# 243 / 11 = 22.09 px per row!
# Let's test Y = 75 + 12 + row * 21
for ($row = 0; $row -lt 12; $row++) {
    $calcY = 88 + ($row * 21)
    $stripY = $calcY - 75
    $g.DrawLine($pen, 0, $stripY, 220, $stripY)
    $txt = "Row " + $row + ": Y=" + $calcY
    $g.DrawString($txt, $font, $brush, 5, ($stripY - 10))
}

$pen.Dispose()
$font.Dispose()
$brush.Dispose()
$g.Dispose()

$stripBmp.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_measured_rows.png", [System.Drawing.Imaging.ImageFormat]::Png)
$stripBmp.Dispose()
$bmp.Dispose()
Write-Host "Saved crop_measured_rows.png"
