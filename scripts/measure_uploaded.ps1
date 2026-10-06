Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791151740065.png"
$bmp = New-Object System.Drawing.Bitmap $imgPath
Write-Host "Width: $($bmp.Width), Height: $($bmp.Height)"

# Now let's crop the sidebar list of animalitos to inspect the exact Y of each item
$cropRect = New-Object System.Drawing.Rectangle(0, 50, 250, 450)
$cropBmp = $bmp.Clone($cropRect, $bmp.PixelFormat)
$cropOut = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_sidebar_millonario.png"
$cropBmp.Save($cropOut, [System.Drawing.Imaging.ImageFormat]::Png)
$cropBmp.Dispose()

# Also let's find the blue highlight line (SELVA PLUS)
for ($y = 100; $y -lt 450; $y += 2) {
    $c = $bmp.GetPixel(120, $y)
    # Check for blue highlight
    if ($c.R -lt 50 -and $c.G -gt 100 -and $c.B -gt 180) {
        Write-Host "Blue highlight at Y=$y (R=$($c.R), G=$($c.G), B=$($c.B))"
    }
}

$bmp.Dispose()
