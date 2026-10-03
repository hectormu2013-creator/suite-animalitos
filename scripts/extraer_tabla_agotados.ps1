param(
    [string]$ImagePath = "..\premier_tabla_sondeo.png"
)

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

# 1. Cargar imagen original
$resolvedPath = (Resolve-Path (Join-Path $PSScriptRoot $ImagePath)).Path
$bmpOriginal = [System.Drawing.Bitmap]::FromFile($resolvedPath)

# Tabla: X=890 a 1400 (ancho 510), Y=130 a 850 (alto 720)
$tableX = 890
$tableY = 130
$tableW = 510
$tableH = [Math]::Min(720, $bmpOriginal.Height - $tableY)

$rectTable = New-Object System.Drawing.Rectangle $tableX, $tableY, $tableW, $tableH
$bmpTable = $bmpOriginal.Clone($rectTable, $bmpOriginal.PixelFormat)

# Upscaling 2x para maxima precision OCR
$bmp2x = New-Object System.Drawing.Bitmap ($bmpTable.Width * 2), ($bmpTable.Height * 2)
$g = [System.Drawing.Graphics]::FromImage($bmp2x)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmpTable, 0, 0, $bmp2x.Width, $bmp2x.Height)
$g.Dispose()

$temp2xFile = Join-Path $PSScriptRoot "temp_table_2x.png"
$bmp2x.Save($temp2xFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp2x.Dispose()
$bmpTable.Dispose()

# 2. Ejecutar Windows OCR
$storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($temp2xFile)) ([Windows.Storage.StorageFile])
$stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$ocrResult = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

# 3. Mapear filas por coordenadas Y
# En la imagen escalada 2x:
# Columna Num en 2x: X ≈ 100 a 160
# Columna Nombre en 2x: X ≈ 240 a 550
# Columna Monto en 2x: X ≈ 700 a 950

$rows = @{}

foreach ($line in $ocrResult.Lines) {
    foreach ($word in $line.Words) {
        $text = $word.Text.Trim()
        if ($text -in @('Num', 'Nombre', 'Monto', 'Jugadas', 'ticket')) { continue }

        $midY = $word.BoundingRect.Y + ($word.BoundingRect.Height / 2)
        # Convertir a escala 1x dentro de la tabla
        $tableY1x = $midY / 2
        # Convertir a coordenada global en la pantalla completa
        $globalY = [int]($tableY + $tableY1x)

        # Agrupar por fila aproximada (tolerancia +- 9px, ya que cada fila mide 18px)
        $matchedRowKey = $null
        foreach ($k in $rows.Keys) {
            if ([Math]::Abs($k - $globalY) -le 9) {
                $matchedRowKey = $k
                break
            }
        }

        if (-not $matchedRowKey) {
            $matchedRowKey = $globalY
            $rows[$matchedRowKey] = [PSCustomObject]@{
                Y = $globalY
                Num = ""
                Nombre = ""
                Monto = ""
                Color = "NORMAL"
            }
        }

        $midX_2x = $word.BoundingRect.X + ($word.BoundingRect.Width / 2)
        # Determinar columna por posicion X en 2x
        if ($midX_2x -lt 200) {
            $rows[$matchedRowKey].Num = $text
        } elseif ($midX_2x -lt 650) {
            $rows[$matchedRowKey].Nombre = $text
        } else {
            $rows[$matchedRowKey].Monto = $text
        }
    }
}

# 4. Clasificar color de cada fila en la imagen original
$rojos = @()
$naranjas = @()
$resultadoFilas = @()

$sortedKeys = $rows.Keys | Sort-Object

foreach ($k in $sortedKeys) {
    $row = $rows[$k]
    $yCheck = [int]$row.Y

    if ($yCheck -ge 0 -and $yCheck -lt $bmpOriginal.Height) {
        # Escanear el rango X de la columna Nombre (X de 1020 a 1180) para evitar coincidir con letras negras
        $redCount = 0
        $orangeCount = 0
        for ($scanX = 1020; $scanX -le 1180; $scanX += 2) {
            $px = $bmpOriginal.GetPixel($scanX, $yCheck)
            if ($px.R -gt 200 -and $px.G -lt 70 -and $px.B -lt 70) {
                $redCount++
            } elseif ($px.R -gt 200 -and $px.G -gt 130 -and $px.G -lt 220 -and $px.B -lt 80) {
                $orangeCount++
            }
        }

        if ($redCount -gt 15) {
            $row.Color = "ROJO"
            if ($row.Num) { $rojos += $row.Num }
        } elseif ($orangeCount -gt 15) {
            $row.Color = "NARANJA"
            if ($row.Num) { 
                $naranjas += [PSCustomObject]@{
                    numero = $row.Num
                    nombre = $row.Nombre
                    cupo = $row.Monto
                }
            }
        }
    }
    $resultadoFilas += $row
}

$bmpOriginal.Dispose()
if (Test-Path $temp2xFile) { Remove-Item $temp2xFile -Force }

# Construir Objeto Final JSON
$finalReport = [PSCustomObject]@{
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    totalDetectados = $resultadoFilas.Count
    rojos = $rojos
    naranjas = $naranjas
    filas = $resultadoFilas
}

Write-Output "=== INICIO REPORTE JSON ==="
$json = $finalReport | ConvertTo-Json -Depth 4
Write-Output $json
Write-Output "=== FIN REPORTE JSON ==="
