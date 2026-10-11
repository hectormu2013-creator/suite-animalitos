# =====================================================================
# MODULO DE PRUEBAS AISLADO: LECTURA Y DETECCION DE CUPOS CERO
# =====================================================================
# Este script NO altera el codigo del sistema ni interactua con ventas.
# Se enfoca exclusivamente en:
# 1. Poner al frente la ventana de Premier Pluss que ya tienes abierta.
# 2. Capturar y analizar la tabla de cupos.
# 3. Extraer OCR de Num, Nombre, Monto.
# 4. Muestrear los colores de cada celda/fila (RGB exacto, Rojo, Naranja).
# 5. Generar un reporte detallado en consola y una imagen anotada (debug_analisis_visual.png).
# =====================================================================

param(
    [string]$Loteria = "GUACHARITO MILLONARIO",
    [string]$TestImagePath = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Registrar WinRT para OCR nativo
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

# Win32 Helpers
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class TestTaquillaProbe {
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
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    public static IntPtr FindPremier() {
        try {
            IntPtr hw = OpenWindowStation("WinSta0", false, 0x10000000);
            if (hw != IntPtr.Zero) SetProcessWindowStation(hw);
            IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
            if (hd != IntPtr.Zero) SetThreadDesktop(hd);
        } catch {}

        IntPtr found = IntPtr.Zero;
        System.Collections.Generic.HashSet<uint> premierPids = new System.Collections.Generic.HashSet<uint>();

        try {
            Process[] procs = Process.GetProcessesByName("PremierPlussPC20");
            foreach (Process p in procs) {
                premierPids.Add((uint)p.Id);
                if (p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
            }
        } catch {}

        // Buscar por PIDs conocidos de PremierPlussPC20
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (premierPids.Contains(pid)) {
                RECT r;
                GetWindowRect(hWnd, out r);
                int w = r.Right - r.Left;
                int h = r.Bottom - r.Top;
                if (w > 350 && h > 200) {
                    found = hWnd;
                    return false;
                }
            }

            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.IndexOf("Premier", StringComparison.OrdinalIgnoreCase) >= 0 || title.IndexOf("Taquilla", StringComparison.OrdinalIgnoreCase) >= 0) {
                RECT r;
                GetWindowRect(hWnd, out r);
                int w = r.Right - r.Left;
                int h = r.Bottom - r.Top;
                if (w > 350 && h > 200) {
                    found = hWnd;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);

        return found;
    }

    public static bool ForceForeground(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return false;
        IntPtr fg = GetForegroundWindow();
        if (fg == hWnd) return true;

        uint fgPid = 0;
        uint targetPid = 0;
        uint fgThread = GetWindowThreadProcessId(fg, out fgPid);
        uint targetThread = GetWindowThreadProcessId(hWnd, out targetPid);

        uint curThread = GetCurrentThreadId();
        try {
            AttachThreadInput(curThread, fgThread, true);
            AttachThreadInput(curThread, targetThread, true);

            keybd_event(0x12, 0, 0, UIntPtr.Zero); // ALT down
            keybd_event(0x12, 0, 2, UIntPtr.Zero); // ALT up

            ShowWindow(hWnd, 9); // SW_RESTORE
            ShowWindow(hWnd, 3); // SW_MAXIMIZE
            SetForegroundWindow(hWnd);
        } catch {}
        finally {
            try { AttachThreadInput(curThread, targetThread, false); } catch {}
            try { AttachThreadInput(curThread, fgThread, false); } catch {}
        }

        System.Threading.Thread.Sleep(100);
        return (GetForegroundWindow() == hWnd);
    }
}
"@

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   MODULO DE PRUEBA: LECTURA Y DETECCION DE CUPOS CERO EN TAQUILLA   " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Cargar diccionario de animales
$dictFile = Join-Path $PSScriptRoot "animal_dictionary.json"
$animalDict = @{}
if (Test-Path $dictFile) {
    try {
        $json = Get-Content $dictFile -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($prop in $json.PSObject.Properties) {
            $animalDict[$prop.Name] = $prop.Value
        }
        Write-Host "[OK] Diccionario cargado con $($animalDict.Count) animales." -ForegroundColor Green
    } catch {
        Write-Host "[WARN] No se pudo parsear el diccionario: $_" -ForegroundColor Yellow
    }
}

function NormalizeNum($n) {
    $s = "$n".Trim()
    if ($s -eq "00") { return "00" }
    if ($s -eq "0") { return "0" }
    if ($s -match '^\d+$') {
        return ([int]$s).ToString("00")
    }
    return $s
}

$rootDir = Split-Path $PSScriptRoot -Parent
$bmpScreen = $null

if ($TestImagePath -and (Test-Path $TestImagePath)) {
    Write-Host "`n[MODO IMAGEN] Usando archivo de prueba: $TestImagePath" -ForegroundColor Magenta
    $bmpScreen = [System.Drawing.Bitmap]::FromFile((Resolve-Path $TestImagePath).Path)
} else {
    # 2. Localizar ventana de Premier Pluss
    Write-Host "`n[PASO 1] Localizando ventana de Premier Pluss..." -ForegroundColor Cyan
    $hwnd = [TestTaquillaProbe]::FindPremier()

    if ($hwnd -eq [IntPtr]::Zero) {
        Write-Host "[ERROR] No se encontro la ventana de Premier Pluss." -ForegroundColor Red
        Write-Host "Asegurate de tener la taquilla abierta con los animales y la tabla en pantalla." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "[OK] Ventana de Premier Pluss localizada (Handle: $hwnd)." -ForegroundColor Green

    # 3. Activar y poner la taquilla al frente
    Write-Host "[PASO 2] Poniendo Premier Pluss en primer plano..." -ForegroundColor Cyan
    $focused = [TestTaquillaProbe]::ForceForeground($hwnd)
    Start-Sleep -Milliseconds 800

    # 4. Capturar pantalla completa
    Write-Host "[PASO 3] Capturando pantalla..." -ForegroundColor Cyan
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmpScreen = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmpScreen)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $g.Dispose()

    $capFile = Join-Path $rootDir "debug_captura_taquilla.png"
    $bmpScreen.Save($capFile, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "[OK] Captura de pantalla guardada en: $capFile ($($bounds.Width)x$($bounds.Height))" -ForegroundColor Green
}

# 5. Calcular rectangulo de la tabla segun resolucion
# NOTA CRITICA: En Premier Pluss (WPF), la rejilla de logos de la izquierda mide 900px fijos.
# Por lo tanto, la tabla SIEMPRE inicia en X=895 - 900 tanto en 1920x1080 como en 1536x864 (125% DPI).
if ($bmpScreen.Width -le 1600) {
    # Resolucion 1536x864 (125% DPI en 1080p)
    $tableX = 895
    $tableY = 115
    $tableW = [Math]::Min(545, ($bmpScreen.Width - $tableX))
    $tableH = [Math]::Min(660, ($bmpScreen.Height - $tableY))
} else {
    # Resolucion 1920x1080 (100% DPI)
    $tableX = 890
    $tableY = 130
    $tableW = 540
    $tableH = [Math]::Min(750, ($bmpScreen.Height - $tableY))
}

Write-Host "`n[PASO 4] Recortando area de la tabla:" -ForegroundColor Cyan
Write-Host " -> Coordenadas: X=$tableX, Y=$tableY, Ancho=$tableW, Alto=$tableH" -ForegroundColor Gray

$rectTable = New-Object System.Drawing.Rectangle $tableX, $tableY, $tableW, $tableH
$bmpTable = $bmpScreen.Clone($rectTable, $bmpScreen.PixelFormat)

$recortePath = Join-Path $rootDir "debug_recorte_tabla.png"
$bmpTable.Save($recortePath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "[OK] Recorte de tabla guardado en: $recortePath" -ForegroundColor Green

# 6. OCR con escala 2x para maxima precision
Write-Host "`n[PASO 5] Ejecutando OCR nativo de Windows (Escala 2x)..." -ForegroundColor Cyan
$width2x = $bmpTable.Width * 2
$height2x = $bmpTable.Height * 2
$bmp2x = New-Object System.Drawing.Bitmap $width2x, $height2x
$g2x = [System.Drawing.Graphics]::FromImage($bmp2x)
$g2x.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2x.DrawImage($bmpTable, 0, 0, $width2x, $height2x)
$g2x.Dispose()

$tempOcrFile = Join-Path $PSScriptRoot "temp_debug_ocr.png"
$bmp2x.Save($tempOcrFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp2x.Dispose()

$storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $tempOcrFile).Path)) ([Windows.Storage.StorageFile])
$stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage(([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1))
}
$ocrRes = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])
Remove-Item $tempOcrFile -Force -ErrorAction SilentlyContinue

Write-Host "[OK] OCR completado. Lineas reconocidas: $(@($ocrRes.Lines).Count)" -ForegroundColor Green

# 7. Agrupar palabras en filas
$groupedRows = @{}
$ignorarPalabras = @('Num', 'Nombre', 'Monto', 'Jugadas', 'ticket', 'Bs', 'Bolivares', 'Sorteo')

foreach ($line in $ocrRes.Lines) {
    foreach ($word in $line.Words) {
        $txt = $word.Text.Trim()
        if ($txt -in $ignorarPalabras) { continue }

        $midY = $word.BoundingRect.Y + ($word.BoundingRect.Height / 2)
        $globalY = [int]($tableY + ($midY / 2)) # En coordenadas de la pantalla 1x

        # Buscar si ya existe una fila cercana (+/- 11px)
        $rowKey = $null
        foreach ($k in $groupedRows.Keys) {
            if ([Math]::Abs($k - $globalY) -le 11) {
                $rowKey = $k
                break
            }
        }
        if (-not $rowKey) {
            $rowKey = $globalY
            $groupedRows[$rowKey] = [PSCustomObject]@{
                Y = $globalY
                LocalY = [int]($midY / 2)
                Num = ""
                Nombre = ""
                Monto = ""
                Color = "NORMAL"
                RedCount = 0
                OrangeCount = 0
                MaxRedVal = 0
                MuestraRGB = ""
                EsCupoCero = $false
            }
        }

        # Separacion por columna horizontal segun posicion X
        $midX_2x = $word.BoundingRect.X + ($word.BoundingRect.Width / 2)
        $ratioX = $midX_2x / $width2x

        if ($ratioX -lt 0.20) {
            $groupedRows[$rowKey].Num = $txt
        } elseif ($ratioX -lt 0.58) {
            if ($groupedRows[$rowKey].Nombre) {
                $groupedRows[$rowKey].Nombre += " $txt"
            } else {
                $groupedRows[$rowKey].Nombre = $txt
            }
        } else {
            $groupedRows[$rowKey].Monto = $txt
        }
    }
}

Write-Host "`n[PASO 6] Analizando celdas y muestreando colores pixel por pixel..." -ForegroundColor Cyan

# Definir franja horizontal de muestreo (Columna Nombre donde Premier pinta el fondo de alerta)
$colNameStart = [int]($tableX + ($tableW * 0.22))
$colNameEnd   = [int]($tableX + ($tableW * 0.52))

# Imagen para anotacion visual
$bmpAnnotated = New-Object System.Drawing.Bitmap $bmpTable
$gAnn = [System.Drawing.Graphics]::FromImage($bmpAnnotated)
$font = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Bold)
$penRed = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 2)
$penOrange = New-Object System.Drawing.Pen([System.Drawing.Color]::Orange, 2)
$penGreen = New-Object System.Drawing.Pen([System.Drawing.Color]::LightGreen, 1)

$rowsOrdenadas = @()
$listaAgotadosRojos = @()
$listaAlertaNaranjas = @()

foreach ($k in ($groupedRows.Keys | Sort-Object)) {
    $rObj = $groupedRows[$k]
    $yC = [int]$rObj.Y

    # Normalizar numero
    if ($rObj.Num) {
        $numLimpio = ($rObj.Num -replace '[^\d]', '').Trim()
        if ($numLimpio) {
            $rObj.Num = NormalizeNum $numLimpio
        }
    }

    # Autocompletar con diccionario si falta Nombre o Num
    if ($rObj.Num -and -not $rObj.Nombre) {
        if ($animalDict.ContainsKey($rObj.Num)) {
            $rObj.Nombre = $animalDict[$rObj.Num]
        } else {
            $nVal = 0
            if ([int]::TryParse($rObj.Num, [ref]$nVal) -and $animalDict.ContainsKey($nVal.ToString())) {
                $rObj.Nombre = $animalDict[$nVal.ToString()]
            }
        }
    } elseif (-not $rObj.Num -and $rObj.Nombre) {
        $nomBuscado = $rObj.Nombre.ToLower().Trim()
        foreach ($pair in $animalDict.GetEnumerator()) {
            if ($pair.Value.ToLower() -like "*$nomBuscado*" -or $nomBuscado -like "*$($pair.Value.ToLower())*") {
                $rObj.Num = NormalizeNum $pair.Key
                if (-not $rObj.Nombre) { $rObj.Nombre = $pair.Value }
                break
            }
        }
    }

    # Muestreo exhaustivo de pixeles en la fila (5 alturas: dy = -4, -2, 0, 2, 4)
    $redPixels = 0
    $orangePixels = 0
    $maxR = 0
    $maxR_sample = ""

    for ($sx = $colNameStart; $sx -le $colNameEnd; $sx += 3) {
        foreach ($dy in @(-4, -2, 0, 2, 4)) {
            $sampY = $yC + $dy
            if ($sampY -ge 0 -and $sampY -lt $bmpScreen.Height -and $sx -lt $bmpScreen.Width) {
                $px = $bmpScreen.GetPixel($sx, $sampY)
                
                if ($px.R -gt $maxR) {
                    $maxR = $px.R
                    $maxR_sample = "RGB($($px.R),$($px.G),$($px.B))"
                }

                # Criterio Rojo Cupo Cero Premier Pluss:
                # Fondo rojo vivo puro (#FF0000 o similar: R muy alto > 190, G y B muy bajos < 70)
                $esRojo = ($px.R -gt 190 -and $px.G -lt 70 -and $px.B -lt 70)
                if ($esRojo) {
                    $redPixels++
                }

                # Criterio Naranja Cupo Reducido:
                # R alto (> 190), G medio (110 a 210), B bajo (< 80)
                $esNaranja = ($px.R -gt 190 -and $px.G -ge 110 -and $px.G -le 210 -and $px.B -lt 80)
                if ($esNaranja) {
                    $orangePixels++
                }
            }
        }
    }

    $rObj.RedCount = $redPixels
    $rObj.OrangeCount = $orangePixels
    $rObj.MaxRedVal = $maxR
    $rObj.MuestraRGB = $maxR_sample

    # Descartar filas espurias de la interfaz (botones, logos de fondo) que no tengan Num o Nombre valido
    if (-not $rObj.Num -and -not $rObj.Nombre) {
        continue
    }

    # Validar si el monto es explicitamente 0
    $montoLimpio = ($rObj.Monto -replace '[^\d,\.]', '').Trim()
    $esMontoCero = ($rObj.Monto -in @('0', '0,0', '0,00', '0.00', '0 Bs', '0,0 Bs')) -or ($montoLimpio -in @('0', '00', '0,00', '0.00', '0,0', '0.0'))

    # Clasificacion final
    if ($redPixels -ge 6 -or $esMontoCero) {
        $rObj.Color = "ROJO"
        $rObj.EsCupoCero = $true
        if ($rObj.Num) { $listaAgotadosRojos += $rObj.Num }
    } elseif ($orangePixels -ge 8) {
        $rObj.Color = "NARANJA"
        if ($rObj.Num) { $listaAlertaNaranjas += $rObj.Num }
    } else {
        $rObj.Color = "NORMAL"
    }

    $rowsOrdenadas += $rObj

    # Dibujar anotacion sobre bmpAnnotated
    $localY = [Math]::Max(0, ($yC - $tableY))
    $pen = $penGreen
    $brush = [System.Drawing.Brushes]::LimeGreen
    if ($rObj.Color -eq "ROJO") {
        $pen = $penRed
        $brush = [System.Drawing.Brushes]::Red
    } elseif ($rObj.Color -eq "NARANJA") {
        $pen = $penOrange
        $brush = [System.Drawing.Brushes]::Orange
    }

    $gAnn.DrawRectangle($pen, 5, ($localY - 8), ($tableW - 10), 18)
    $tag = "[$($rObj.Num) $($rObj.Nombre)] Monto: $($rObj.Monto) | $($rObj.Color) (Rojos:$redPixels, Nar:$orangePixels, Sample:$maxR_sample)"
    $gAnn.DrawString($tag, $font, $brush, 8, ($localY - 7))
}

$gAnn.Dispose()
$annotatedPath = Join-Path $rootDir "debug_analisis_visual.png"
$bmpAnnotated.Save($annotatedPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmpAnnotated.Dispose()
$bmpTable.Dispose()
$bmpScreen.Dispose()

Write-Host "[OK] Imagen de analisis visual generada en: $annotatedPath" -ForegroundColor Green

# 8. Reporte detallado en consola
Write-Host "`n======================================================================" -ForegroundColor Yellow
Write-Host "               TABLA DE FILAS DETECTADAS EN PANTALLA                  " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host ("{0,-5} {1,-14} {2,-12} {3,-9} {4,-8} {5,-8} {6,-16}" -f "NUM", "NOMBRE", "MONTO", "ESTADO", "PX_ROJO", "PX_NAR", "MUESTRA_RGB") -ForegroundColor Cyan
Write-Host ("-" * 75) -ForegroundColor Gray

foreach ($r in $rowsOrdenadas) {
    $colorFmt = "Gray"
    if ($r.Color -eq "ROJO") { $colorFmt = "Red" }
    elseif ($r.Color -eq "NARANJA") { $colorFmt = "DarkYellow" }

    Write-Host ("{0,-5} {1,-14} {2,-12} {3,-9} {4,-8} {5,-8} {6,-16}" -f $r.Num, $r.Nombre, $r.Monto, $r.Color, $r.RedCount, $r.OrangeCount, $r.MuestraRGB) -ForegroundColor $colorFmt
}

Write-Host "`n======================================================================" -ForegroundColor Yellow
Write-Host "                    RESUMEN DEL DIAGNOSTICO                           " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host "Total filas leidas en la tabla:     $($rowsOrdenadas.Count)" -ForegroundColor White
Write-Host "Total AGOTADOS (Cupo Cero / ROJO):  $($listaAgotadosRojos.Count)" -ForegroundColor Red
if ($listaAgotadosRojos.Count -gt 0) {
    Write-Host " -> NUMEROS EN CUPO CERO:           $($listaAgotadosRojos -join ', ')" -ForegroundColor Red
} else {
    Write-Host " -> NUMEROS EN CUPO CERO:           NINGUNO DETECTADO" -ForegroundColor Green
}

Write-Host "Total ALERTA (Cupo Reducido / NAR): $($listaAlertaNaranjas.Count)" -ForegroundColor Yellow
if ($listaAlertaNaranjas.Count -gt 0) {
    Write-Host " -> NUMEROS CON ALERTA:             $($listaAlertaNaranjas -join ', ')" -ForegroundColor Yellow
}

Write-Host "`n[ARCHIVOS DE REVISION VISUAL GENERADOS]:" -ForegroundColor Cyan
Write-Host "1. $capFile (Pantalla completa)" -ForegroundColor Gray
Write-Host "2. $recortePath (Recorte de la tabla analizada)" -ForegroundColor Gray
Write-Host "3. $annotatedPath (Analisis visual con cuadros y muestreos)" -ForegroundColor Green
Write-Host "======================================================================`n" -ForegroundColor Yellow
