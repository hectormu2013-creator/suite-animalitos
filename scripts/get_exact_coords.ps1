Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
Write-Output "Image size: $($bmp.Width) x $($bmp.Height)"

# 1. Let's find Y of each lottery item in the left list (at X = 120)
# Look at color changes along vertical line X=120 from Y=140 to Y=550
$prevColor = ""
for ($y = 140; $y -le 540; $y += 2) {
    $c = $bmp.GetPixel(120, $y)
    # Check if text or background
    # Let's sample every 10 pixels to see list boundaries
}

# Let's crop just the lottery list: X=10, Y=140, W=230, H=400
$rectList = New-Object System.Drawing.Rectangle 10, 140, 230, 400
$cropList = $bmp.Clone($rectList, $bmp.PixelFormat)
$cropList.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_calibrated_list.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropList.Dispose()

# Let's crop the sorteos header: X=240, Y=30, W=340, H=70
$rectSort = New-Object System.Drawing.Rectangle 240, 30, 340, 70
$cropSort = $bmp.Clone($rectSort, $bmp.PixelFormat)
$cropSort.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_calibrated_sorteos.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropSort.Dispose()

$bmp.Dispose()
Write-Output "Calibrated crops saved!"
