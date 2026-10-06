Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\.user_uploaded\media_1791151740065.png"
$bmp = New-Object System.Drawing.Bitmap $imgPath

# Find the stripe separators (borders between rows)
# The sidebar starts around X=120
# Let's inspect pixel brightness or borders between Y=60 and Y=360
Write-Host "Analyzing Y rows in sidebar at X=120:"
# We know SELVA PLUS is at Y=310-326 (height ~20px)
# Let's check from Y=70 to Y=350 in steps of 1 to see the row boundary lines
for ($y = 70; $y -le 350; $y++) {
    $c = $bmp.GetPixel(120, $y)
    # Check if border (usually grayish or different from white/light blue)
    $cBorder = $bmp.GetPixel(10, $y)
}

# Let's calculate mathematically based on row height:
# Top of first row (RICACHONA):
for ($y = 70; $y -lt 120; $y++) {
    $c = $bmp.GetPixel(50, $y)
    if ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240) {
        # Background white
    }
}

# Let's find exactly the center of each of the 12 rows:
# Notice that each row has height ~20px:
# Let's crop each row 15px tall and check:
for ($row = 0; $row -lt 12; $row++) {
    $approxY = 88 + ($row * 20.8)
    Write-Host "Row $row approx Y: $([int]$approxY)"
}
$bmp.Dispose()
