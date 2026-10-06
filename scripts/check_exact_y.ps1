Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png")

# Let's crop a narrow strip containing the lottery names at X=15 to X=200, Y=140 to Y=380
$rect = New-Object System.Drawing.Rectangle 15, 140, 200, 240
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
$crop.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_names_y.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$bmp.Dispose()
Write-Output "Crop saved!"
