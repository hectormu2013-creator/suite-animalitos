Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_names_y.png")

# Let's inspect white vs light-blue alternating stripes
# In the crop:
for ($y = 0; $y -lt $bmp.Height; $y += 2) {
    $c = $bmp.GetPixel(50, $y)
    # Check if header (dark blue), stripe 1 (light blue), stripe 2 (white)
    $type = "OTHER"
    if ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240) { $type = "WHITE" }
    elseif ($c.R -gt 220 -and $c.G -gt 230 -and $c.B -gt 245) { $type = "LIGHTBLUE" }
    elseif ($c.B -gt 180 -and $c.R -lt 50) { $type = "DARKBLUE_HEADER" }
    Write-Output "CropY=$y (ScreenY=$($y+140)): $type (R=$($c.R),G=$($c.G),B=$($c.B))"
}
$bmp.Dispose()
