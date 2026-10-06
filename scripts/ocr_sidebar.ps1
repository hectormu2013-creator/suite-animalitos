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

$bmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\premier_pantalla_calibrada.png")
$rect = New-Object System.Drawing.Rectangle 10, 100, 240, 400
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
$tempOcr = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\scripts\temp_sidebar_ocr.png"
$crop.Save($tempOcr, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$bmp.Dispose()

$storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempOcr)) ([Windows.Storage.StorageFile])
$stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$ocrRes = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

Write-Host "=== OCR RESULTS FOR SIDEBAR (Origin Y = 100) ==="
foreach ($line in $ocrRes.Lines) {
    $firstWord = $null
    foreach ($w in $line.Words) { $firstWord = $w; break }
    if ($firstWord) {
        $topY = [int]$firstWord.BoundingRect.Y
        $h = [int]$firstWord.BoundingRect.Height
        $midY = $topY + [int]($h / 2)
        $screenY = 100 + $midY
        Write-Host ("Text: " + $line.Text.PadRight(25) + " | BoxTop: " + $topY + " | CenterScreenY: " + $screenY)
    }
}
Remove-Item $tempOcr -Force -ErrorAction SilentlyContinue
