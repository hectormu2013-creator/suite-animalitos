Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

# Bottom left (x=0 to 600, y=750 to 864)
$cropBL = $bmp.Clone((New-Object System.Drawing.Rectangle 0, 750, 600, 114), $bmp.PixelFormat)
$cropBL.Save((Join-Path $PSScriptRoot "..\crop_bottom_left.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropBL.Dispose()

# Bottom right (x=600 to 1536, y=750 to 864)
$cropBR = $bmp.Clone((New-Object System.Drawing.Rectangle 600, 750, 936, 114), $bmp.PixelFormat)
$cropBR.Save((Join-Path $PSScriptRoot "..\crop_bottom_right.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropBR.Dispose()

# Middle bottom
$cropMB = $bmp.Clone((New-Object System.Drawing.Rectangle 380, 500, 550, 350), $bmp.PixelFormat)
$cropMB.Save((Join-Path $PSScriptRoot "..\crop_middle_bottom.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cropMB.Dispose()

$bmp.Dispose()
Write-Output "Recortes de bordes guardados."
