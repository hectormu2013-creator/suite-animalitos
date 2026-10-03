Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile((Resolve-Path (Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png")).Path)
# Grid scrollbar is at X ≈ 790 to 805, Y ≈ 110 to 850
$rect = New-Object System.Drawing.Rectangle 790, 110, 25, 740
$crop = $b.Clone($rect, $b.PixelFormat)
$crop.Save((Join-Path $PSScriptRoot "..\crop_live_scrollbar.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$b.Dispose()
Write-Output "Cropped scrollbar"
