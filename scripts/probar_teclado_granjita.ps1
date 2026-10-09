param(
    [int]$MontoSondeo = 3000
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Registrar tipos WinRT para OCR nativo de Windows
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

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class PremierGranjitaProbe {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
    public const uint MOUSEEVENTF_WHEEL    = 0x0800;

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(40);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(40);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void ScrollWheel(int x, int y, int ticks, int delta) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(40);
        for (int i = 0; i < ticks; i++) {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, UIntPtr.Zero);
            System.Threading.Thread.Sleep(20);
        }
    }

    public static void ScrollTableBottom(int x, int y) {
        ScrollWheel(x, y, 35, -120);
    }

    public static IntPtr FindPremier() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                    RECT r;
                    GetWindowRect(hWnd, out r);
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    bool vis = IsWindowVisible(hWnd);
                    bool min = IsIconic(hWnd);
                    if (min || (vis && w > 300 && h > 200)) {
                        found = hWnd;
                        return false;
                    }
                    if (found == IntPtr.Zero) {
                        found = hWnd;
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);

        if (found == IntPtr.Zero) {
            EnumWindows((hWnd, lParam) => {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(hWnd, title, 256);
                string t = title.ToString();
                if (t.Contains("Premier Pluss") || t.Contains("PremierPluss")) {
                    found = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
        }

        return found;
    }
}
"@

# Cargar Diccionario de Animalitos
$dictFile = Join-Path $PSScriptRoot "animal_dictionary.json"
$animalDict = @{}
if (Test-Path $dictFile) {
    $rawDict = Get-Content $dictFile -Raw | ConvertFrom-Json
    foreach ($prop in $rawDict.PSObject.Properties) {
        $animalDict[$prop.Name] = $prop.Value
    }
}

Write-Output "=========================================================="
Write-Output "   SONDEO COMPLETO POR TECLADO - LA GRANJITA (38 ANIMALES)"
Write-Output "=========================================================="

$hwnd = [PremierGranjitaProbe]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "[ERROR] Premier Pluss 2.0 no esta abierto."
    exit 1
}

Write-Output "[1/6] Enfocando y maximizando Premier Pluss..."
[PremierGranjitaProbe]::ShowWindow($hwnd, 9)
[PremierGranjitaProbe]::ShowWindow($hwnd, 3)
[PremierGranjitaProbe]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 600

# Cerrar cualquier diálogo previo
[System.Windows.Forms.SendKeys]::SendWait("{ESC}")
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 150

# Limpiar pantalla previa
Write-Output "[2/6] Limpiando pantalla inicial..."
[System.Windows.Forms.SendKeys]::SendWait("n")
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 250

# SELECCION OBLIGATORIA DE MONEDA BS (BOLIVARES)
Write-Output "[2.5/6] Configurando moneda obligatoria en BS (Bolivares)..."
[PremierGranjitaProbe]::Click(1096, 58)
Start-Sleep -Milliseconds 300
[PremierGranjitaProbe]::Click(1096, 92)
Start-Sleep -Milliseconds 300
Write-Output "[OK] Moneda fijada en BS."

# 1. Seleccionar LA GRANJITA (X=120, Y=173)
Write-Output "[3/6] Seleccionando LA GRANJITA en menu lateral..."
[PremierGranjitaProbe]::Click(120, 173)
Start-Sleep -Milliseconds 500

# 2. Marcar proximo sorteo (Q) (X=328, Y=63)
Write-Output "[4/6] Marcando casilla del proximo sorteo..."
[PremierGranjitaProbe]::Click(328, 63)
Start-Sleep -Milliseconds 400

# 3. Precargar Monto de sondeo en F6
Write-Output "[5/6] Precargando Monto de sondeo ($MontoSondeo Bs)..."
[System.Windows.Forms.SendKeys]::SendWait("{F6}")
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait("$MontoSondeo")
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 250

# 4. Lista de 38 animales de La Granjita (00, 0, 1 al 36)
$animalesGranjita = @("00", "0") + (1..36 | ForEach-Object { "$_" })
Write-Output "[6/6] Ingresando los 38 animales por teclado a ritmo continuo..."

$idx = 0
foreach ($anim in $animalesGranjita) {
    $idx++
    Write-Host -NoNewline "`r -> Ingresando animal [$idx/38]: '$anim'..."
    
    [System.Windows.Forms.SendKeys]::SendWait("{F5}")
    Start-Sleep -Milliseconds 50
    [System.Windows.Forms.SendKeys]::SendWait("$anim")
    Start-Sleep -Milliseconds 60
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 180
}

Write-Output "`n[OK] Los 38 animales fueron ingresados al ticket."
Start-Sleep -Milliseconds 500

# 5. DISPARO DE VALIDACION: Atajo nativo Tecla 'I' (Imprimir)
Write-Output "`n[EVALUACION] Disparando validacion mediante atajo oficial Tecla 'I'..."
try {
    [System.Windows.Forms.SendKeys]::SendWait("i")
    Write-Output " -> [OK] Atajo oficial 'I' enviado con exito."
} catch {
    $boundsScreen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $clickX = [int]($boundsScreen.Width * 0.835)
    [PremierGranjitaProbe]::Click($clickX, 65)
}
Start-Sleep -Milliseconds 2500

# Función OCR de extracción de filas de la tabla
function ExtraerFilasDePantalla($bmpScreen) {
    $tableX = 890
    $tableY = 130
    $tableW = 510
    $tableH = [Math]::Min(720, $bmpScreen.Height - $tableY)

    $rectTable = New-Object System.Drawing.Rectangle $tableX, $tableY, $tableW, $tableH
    $bmpTable = $bmpScreen.Clone($rectTable, $bmpScreen.PixelFormat)

    # 2x Upscale para OCR nítido
    $bmp2x = New-Object System.Drawing.Bitmap ($bmpTable.Width * 2), ($bmpTable.Height * 2)
    $g = [System.Drawing.Graphics]::FromImage($bmp2x)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bmpTable, 0, 0, $bmp2x.Width, $bmp2x.Height)
    $g.Dispose()

    $tempFile = Join-Path $PSScriptRoot "temp_granjita_ocr.png"
    $bmp2x.Save($tempFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp2x.Dispose()
    $bmpTable.Dispose()

    $storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempFile)) ([Windows.Storage.StorageFile])
    $stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    $ocrRes = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

    $extractedRows = @()
    $groupedRows = @{}

    foreach ($line in $ocrRes.Lines) {
        foreach ($word in $line.Words) {
            $txt = $word.Text.Trim()
            if ($txt -in @('Num', 'Nombre', 'Monto', 'Jugadas', 'ticket', 'Bs', 'Bolivares')) { continue }

            $midY = $word.BoundingRect.Y + ($word.BoundingRect.Height / 2)
            $globalY = [int]($tableY + ($midY / 2))

            $rowKey = $null
            foreach ($k in $groupedRows.Keys) {
                if ([Math]::Abs($k - $globalY) -le 9) {
                    $rowKey = $k
                    break
                }
            }
            if (-not $rowKey) {
                $rowKey = $globalY
                $groupedRows[$rowKey] = [PSCustomObject]@{
                    Y = $globalY
                    Num = ""
                    Nombre = ""
                    Monto = ""
                    Color = "NORMAL"
                }
            }

            $midX_2x = $word.BoundingRect.X + ($word.BoundingRect.Width / 2)
            if ($midX_2x -lt 200) {
                $groupedRows[$rowKey].Num = $txt
            } elseif ($midX_2x -lt 650) {
                $groupedRows[$rowKey].Nombre = $txt
            } else {
                $groupedRows[$rowKey].Monto = $txt
            }
        }
    }

    foreach ($k in ($groupedRows.Keys | Sort-Object)) {
        $rObj = $groupedRows[$k]
        $yC = [int]$rObj.Y

        if ($yC -ge 150 -and $yC -lt ($bmpScreen.Height - 40)) {
            $redCount = 0
            $orangeCount = 0
            for ($sx = 1020; $sx -le 1180; $sx += 2) {
                $px = $bmpScreen.GetPixel($sx, $yC)
                if ($px.R -gt 200 -and $px.G -lt 70 -and $px.B -lt 70) {
                    $redCount++
                } elseif ($px.R -gt 200 -and $px.G -gt 130 -and $px.G -lt 220 -and $px.B -lt 80) {
                    $orangeCount++
                }
            }

            if ($redCount -gt 15) {
                $rObj.Color = "ROJO"
            } elseif ($orangeCount -gt 15) {
                $rObj.Color = "NARANJA"
            }

            if ($rObj.Num -and -not $rObj.Nombre -and $animalDict.ContainsKey($rObj.Num)) {
                $rObj.Nombre = $animalDict[$rObj.Num]
            }
            if (-not $rObj.Num -and $rObj.Nombre) {
                foreach ($pair in $animalDict.GetEnumerator()) {
                    if ($pair.Value -like "*$($rObj.Nombre)*" -or $rObj.Nombre -like "*$($pair.Value)*") {
                        $rObj.Num = $pair.Key
                        break
                    }
                }
            }

            if ($rObj.Num) {
                $extractedRows += $rObj
            }
        }
    }

    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
    return $extractedRows
}

# 6. Analizar estado de la tabla
Write-Output "[ANALISIS] Capturando y procesando tabla de resultados (Vista 1)..."
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmpFull1 = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g1 = [System.Drawing.Graphics]::FromImage($bmpFull1)
$g1.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$outFile = Join-Path $PSScriptRoot "..\granjita_tabla_sondeo.png"
$bmpFull1.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

$todasLasFilas = @{}
$rowsView1 = ExtraerFilasDePantalla $bmpFull1
foreach ($r in $rowsView1) {
    $todasLasFilas[$r.Num] = $r
}
$g1.Dispose()
$bmpFull1.Dispose()

# Scroll tabla para Vista 2 (ver el resto de los 38 animales)
Write-Output "[ANALISIS] Desplazando tabla del ticket hacia abajo para Vista 2..."
[PremierGranjitaProbe]::ScrollTableBottom(1050, 400)
Start-Sleep -Milliseconds 600

$bmpFull2 = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g2 = [System.Drawing.Graphics]::FromImage($bmpFull2)
$g2.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$rowsView2 = ExtraerFilasDePantalla $bmpFull2
foreach ($r in $rowsView2) {
    if (-not $todasLasFilas.ContainsKey($r.Num)) {
        $todasLasFilas[$r.Num] = $r
    } else {
        if ($r.Color -eq "ROJO") { $todasLasFilas[$r.Num].Color = "ROJO" }
        elseif ($r.Color -eq "NARANJA" -and $todasLasFilas[$r.Num].Color -ne "ROJO") { $todasLasFilas[$r.Num].Color = "NARANJA" }
    }
}
$g2.Dispose()
$bmpFull2.Dispose()

# =====================================================================
# REGLA DE ORO DE SEGURIDAD ABSOLUTA: LIMPIAR TICKET CON TECLA 'N'
# =====================================================================
Write-Output "`n[REGLA DE ORO] Cancelando jugada y limpiando pantalla de Premier Pluss..."
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait("n")
Start-Sleep -Milliseconds 350
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 200

Write-Output "[SEGURIDAD OK] Pantalla restablecida a 0 jugadas."

# Consolidar Resultados
$listaRojos = @()
$listaNaranjas = @()
$listaNormales = @()

foreach ($num in ($todasLasFilas.Keys | Sort-Object { if ($_ -eq "00") { -1 } else { [int]$_ } })) {
    $row = $todasLasFilas[$num]
    if ($row.Color -eq "ROJO") {
        $listaRojos += $num
    } elseif ($row.Color -eq "NARANJA") {
        $listaNaranjas += [PSCustomObject]@{
            numero = $row.Num
            nombre = $row.Nombre
            cupo = $row.Monto
        }
    } else {
        $listaNormales += $num
    }
}

Write-Output "`n=========================================================="
Write-Output "   REPORTE DE ESTADO DE CUPOS - LA GRANJITA"
Write-Output "=========================================================="
Write-Output "TOTAL ANIMALES ANALIZADOS:               $($todasLasFilas.Count) de 38"
Write-Output "TOTAL ANIMALES 100% AGOTADOS (ROJO):     $($listaRojos.Count)"
Write-Output "TOTAL ANIMALES CUPO REDUCIDO (NARANJA):  $($listaNaranjas.Count)"

if ($listaRojos.Count -gt 0) {
    Write-Output ">>> AGOTADOS DETECTADOS: $($listaRojos -join ', ')"
}
if ($listaNaranjas.Count -gt 0) {
    $narStr = ($listaNaranjas | ForEach-Object { "$($_.numero) ($($_.nombre): $($_.cupo) Bs)" }) -join ", "
    Write-Output ">>> CUPOS REDUCIDOS: $narStr"
}
Write-Output "=========================================================="
