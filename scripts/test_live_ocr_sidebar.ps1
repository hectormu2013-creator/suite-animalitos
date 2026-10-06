Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
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

# Capturar columna izquierda de la pantalla completa (X: 10 a 280, Y: 100 a 600)
$sidebarX = 10
$sidebarY = 100
$sidebarW = 270
$sidebarH = 500

$bmp = New-Object System.Drawing.Bitmap $sidebarW, $sidebarH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($sidebarX, $sidebarY, 0, 0, (New-Object System.Drawing.Size $sidebarW, $sidebarH))
$g.Dispose()

# Guardar temporal
$tempFile = Join-Path $PSScriptRoot "temp_sidebar_live.png"
$bmp.Save($tempFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempFile)) ([Windows.Storage.StorageFile])
$stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$softwareBitmap = Await ([Windows.Graphics.Imaging.SoftwareBitmap])
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$ocrRes = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

Write-Host "`n========================================================"
Write-Host "  LOTERIAS DETECTADAS EN VIVO POR OCR EN PANTALLA"
Write-Host "========================================================"

$detectedLoterias = @()

foreach ($line in $ocrRes.Lines) {
    $lineText = $line.Text.Trim()
    if ($lineText -in @("Animalitos:", "Resultados", "Ultimos Premiados")) { continue }

    # Tomar la primera y ultima palabra para calcular el centro
    $firstWord = $line.Words[0]
    $lastWord = $line.Words[$line.Words.Count - 1]

    $topY = $firstWord.BoundingRect.Y
    $height = $firstWord.BoundingRect.Height
    $midY = [int]($topY + ($height / 2))
    $realScreenY = $sidebarY + $midY

    # Coordenada X centrada en el sidebar (aprox 120-140)
    $realScreenX = 135

    $lotObj = [PSCustomObject]@{
        Texto = $lineText
        ScreenX = $realScreenX
        ScreenY = $realScreenY
        Height = $height
    }
    $detectedLoterias += $lotObj
    Write-Host (" -> [Y=" + $realScreenY + "] " + $lineText)
}

Write-Host "========================================================`n"
if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
