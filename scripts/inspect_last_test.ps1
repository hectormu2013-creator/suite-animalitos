Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
}[0]

function Await($asyncOp, $type) {
    $m = $asTaskGeneric.MakeGenericMethod($type)
    $task = $m.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

$imgFile = 'C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\premier_tabla_sondeo.png'
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)
Write-Host "Dimensions: $($bmp.Width) x $($bmp.Height)"

# Escaneo de filas rojas: X=950 a 1350, Y=130 a 720
$redLines = @()
for ($y = 130; $y -le 720; $y++) {
    $redPixels = 0
    for ($x = 950; $x -le 1350; $x += 2) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -gt 200 -and $p.G -lt 85 -and $p.B -lt 85) {
            $redPixels++
        }
    }
    if ($redPixels -gt 10) {
        $redLines += $y
    }
}

# Agrupar lineas contiguas
$redRows = @()
$currentGroup = @()
foreach ($y in $redLines) {
    if ($currentGroup.Count -eq 0 -or ($y - $currentGroup[-1]) -le 4) {
        $currentGroup += $y
    } else {
        $midY = [int]($currentGroup[0] + ($currentGroup[-1] - $currentGroup[0]) / 2)
        $redRows += $midY
        $currentGroup = @($y)
    }
}
if ($currentGroup.Count -gt 0) {
    $midY = [int]($currentGroup[0] + ($currentGroup[-1] - $currentGroup[0]) / 2)
    $redRows += $midY
}

Write-Host "Filas ROJAS encontradas: $($redRows.Count) en Ys: $($redRows -join ', ')"

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
foreach ($rY in $redRows) {
    $cropY = [Math]::Max(0, $rY - 10)
    $rect = New-Object System.Drawing.Rectangle 890, $cropY, 480, 22
    $cropBmp = $bmp.Clone($rect, $bmp.PixelFormat)
    $crop2x = New-Object System.Drawing.Bitmap ($cropBmp.Width * 2), ($cropBmp.Height * 2)
    $g = [System.Drawing.Graphics]::FromImage($crop2x)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($cropBmp, 0, 0, $crop2x.Width, $crop2x.Height)
    $g.Dispose()
    
    $tempPath = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\temp_red_$rY.png"
    $crop2x.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $crop2x.Dispose()
    $cropBmp.Dispose()
    
    $storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempPath)) ([Windows.Storage.StorageFile])
    $stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $sBmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Await ($engine.RecognizeAsync($sBmp)) ([Windows.Media.Ocr.OcrResult])
    Write-Host "FILA ROJA en Y=$rY -> Texto Detectado: '$($res.Text)'"
    Remove-Item $tempPath -Force
}

# Analizar también la tabla completa para listar todos los animales presentes
Write-Host "`n--- Escaneo de todas las filas en la tabla ---"
$rectAll = New-Object System.Drawing.Rectangle 890, 130, 480, 590
$cropAll = $bmp.Clone($rectAll, $bmp.PixelFormat)
$allPath = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\temp_table_all.png"
$cropAll.Save($allPath, [System.Drawing.Imaging.ImageFormat]::Png)
$cropAll.Dispose()

$storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($allPath)) ([Windows.Storage.StorageFile])
$stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$sBmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$res = Await ($engine.RecognizeAsync($sBmp)) ([Windows.Media.Ocr.OcrResult])
Remove-Item $allPath -Force

foreach ($line in $res.Lines) {
    Write-Host "  Linea: $($line.Text)"
}

$bmp.Dispose()
