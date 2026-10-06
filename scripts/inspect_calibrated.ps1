Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png")
Write-Host "premier_pantalla_calibrada size: $($bmp.Width) x $($bmp.Height)"

# Now let's crop the lottery list area from premier_pantalla_calibrada.png
# and find where GUACHARITO MILLONARIO is!
$rect = New-Object System.Drawing.Rectangle 10, 100, 240, 320
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
$crop.Save("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\crop_calibrated_full_names.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$bmp.Dispose()
Write-Host "Saved crop_calibrated_full_names.png"
