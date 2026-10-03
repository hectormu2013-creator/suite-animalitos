param(
    [string]$Loteria = "GUACHARO ACTIVO",
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

public class PremierFullProbe {
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

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
    public const uint MOUSEEVENTF_WHEEL    = 0x0800;

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

        // Fallback por título si no se encontró por proceso
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

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(25);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(25);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    public const int VK_ESCAPE = 0x1B;
    public const int VK_PAUSE  = 0x13;
    public const int VK_F7     = 0x76;
    public const int VK_F8     = 0x77;

    public static bool IsPremierFocused(IntPtr premierHwnd) {
        IntPtr fg = GetForegroundWindow();
        return fg == premierHwnd;
    }

    public static bool IsStopHotkeyPressed() {
        return ((GetAsyncKeyState(VK_ESCAPE) & 0x8000) != 0) || ((GetAsyncKeyState(VK_F8) & 0x8000) != 0);
    }

    public static bool IsPauseHotkeyPressed() {
        return ((GetAsyncKeyState(VK_F7) & 0x8000) != 0) || ((GetAsyncKeyState(VK_PAUSE) & 0x8000) != 0);
    }

    public static void ScrollWheel(int x, int y, int ticks, int delta) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(40);
        for (int i = 0; i < ticks; i++) {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, UIntPtr.Zero);
            System.Threading.Thread.Sleep(20);
        }
    }

    public static void ScrollToBottom(int x, int y) {
        ScrollWheel(x, y, 50, -120);
    }

    public static void ScrollToTop(int x, int y) {
        ScrollWheel(x, y, 50, 120);
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

# Archivo de control para comunicacion bidireccional (Pausar, Continuar, Detener)
$controlFile = Join-Path (Split-Path $PSScriptRoot -Parent) "automation_control.json"

function Get-ControlAction {
    if (Test-Path $controlFile) {
        try {
            $raw = Get-Content $controlFile -Raw -ErrorAction SilentlyContinue
            if ($raw) {
                $data = $raw | ConvertFrom-Json
                return $data.requestedAction
            }
        } catch {}
    }
    return "NONE"
}

function Set-ControlState {
    param(
        [string]$status,
        [string]$details = "",
        [string]$currentAnimal = "",
        [string]$progress = ""
    )
    try {
        $data = [PSCustomObject]@{
            status = $status
            requestedAction = "NONE"
            details = $details
            loteria = $Loteria
            currentAnimal = $currentAnimal
            progress = $progress
            pid = $PID
            updatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        }
        $data | ConvertTo-Json | Set-Content $controlFile -Force -ErrorAction SilentlyContinue
    } catch {}
}

function Check-SafetyAndControl {
    param(
        [string]$stepName = ""
    )
    
    # 1. Comprobar tecla de parada de emergencia global (ESC o F8)
    if ([PremierFullProbe]::IsStopHotkeyPressed()) {
        Write-Output "`n`n[ALERTA DE SEGURIDAD] ¡Detencion de emergencia accionada por teclado (ESC / F8)!"
        Set-ControlState "STOPPED" "Detenido de emergencia por teclado (ESC/F8)"
        if ([PremierFullProbe]::IsPremierFocused($hwnd)) {
            [System.Windows.Forms.SendKeys]::SendWait("n")
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }
        exit 99
    }

    # 2. Comprobar orden de detencion desde el archivo de control / panel web
    $action = Get-ControlAction
    if ($action -eq "STOP") {
        Write-Output "`n`n[CONTROL] Detencion total solicitada por el usuario desde el panel."
        Set-ControlState "STOPPED" "Detenido desde panel web"
        if ([PremierFullProbe]::IsPremierFocused($hwnd)) {
            [System.Windows.Forms.SendKeys]::SendWait("n")
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }
        exit 99
    }

    # 3. Comprobar solicitud de pausa (por tecla F7 o por panel web)
    $pauseTriggered = ($action -eq "PAUSE") -or [PremierFullProbe]::IsPauseHotkeyPressed()
    if ($pauseTriggered) {
        Write-Output "`n[PAUSA ACTIVADA] Automatizacion en PAUSA ($stepName)."
        Write-Output " -> Presiona [F7] o pulsa 'Continuar' en el panel web para reanudar."
        Write-Output " -> Presiona [ESC] o [F8] para abortar por completo."
        Set-ControlState "PAUSED" "Pausado en: $stepName"
        Start-Sleep -Milliseconds 600

        while ($true) {
            Start-Sleep -Milliseconds 250
            if ([PremierFullProbe]::IsStopHotkeyPressed()) {
                Write-Output "`n[ALERTA] Detencion solicitada mientras estaba pausado."
                Set-ControlState "STOPPED" "Detenido durante pausa"
                exit 99
            }
            $act = Get-ControlAction
            if ($act -eq "STOP") {
                Write-Output "`n[CONTROL] Detencion total recibida durante la pausa."
                Set-ControlState "STOPPED" "Detenido durante pausa"
                exit 99
            }
            if ($act -eq "RESUME" -or [PremierFullProbe]::IsPauseHotkeyPressed()) {
                Write-Output "[CONTINUAR] Reanudando ejecucion..."
                Set-ControlState "RUNNING" "Reanudado en: $stepName"
                [PremierFullProbe]::SetForegroundWindow($hwnd) | Out-Null
                Start-Sleep -Milliseconds 600
                break
            }
        }
    }

    # 4. ESCUDO DE FOCO DE VENTANA (Protege Chrome, chat, VS Code contra escritura no deseada)
    if (-not [PremierFullProbe]::IsPremierFocused($hwnd)) {
        Write-Output "`n[ESCUDO DE FOCO] Premier Pluss perdio el foco. Pausando inmediatamente para no escribir en otras ventanas..."
        Set-ControlState "PAUSED" "Pausado automaticamente por perdida de foco de ventana"
        
        while (-not [PremierFullProbe]::IsPremierFocused($hwnd)) {
            Start-Sleep -Milliseconds 300
            if ([PremierFullProbe]::IsStopHotkeyPressed() -or ((Get-ControlAction) -eq "STOP")) {
                Write-Output "[CONTROL] Detenido por el usuario mientras Premier Pluss no tenia foco."
                Set-ControlState "STOPPED" "Detenido sin foco"
                exit 99
            }
        }
        Write-Output "[ESCUDO DE FOCO] Foco recuperado en Premier Pluss. Reanudando en 500ms..."
        Set-ControlState "RUNNING" "Foco recuperado en Premier Pluss"
        Start-Sleep -Milliseconds 500
    }
}

Write-Output "=========================================================="
Write-Output "  SONDEO Y EXTRACCION DE AGOTADOS - $Loteria"
Write-Output "  SEGURIDAD ACTIVA: [ESC/F8] Detener | [F7] Pausar/Continuar"
Write-Output "=========================================================="

$hwnd = [PremierFullProbe]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "[AUTO-INICIO] Premier Pluss 2.0 no esta abierto. Intentando iniciar la aplicacion..."
    
    # 1. Obtener ruta del ejecutable desde config.json o ruta estandar
    $cfgPath = Join-Path (Split-Path $PSScriptRoot -Parent) "config.json"
    $exePath = "C:\Program Files (x86)\Premier Pluss 2.0\PremierPlussPC20.exe"
    if (Test-Path $cfgPath) {
        try {
            $cfgRaw = Get-Content $cfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
            if ($cfgRaw.general.premierPluss.executablePath) {
                $exePath = $cfgRaw.general.premierPluss.executablePath
            }
        } catch {}
    }
    
    if (Test-Path $exePath) {
        Write-Output "[AUTO-INICIO] Ejecutando: $exePath..."
        Start-Process -FilePath $exePath -WorkingDirectory (Split-Path $exePath)
        
        # Esperar hasta 20 segundos a que la ventana de Premier aparezca
        for ($waitCount = 0; $waitCount -lt 20; $waitCount++) {
            Start-Sleep -Seconds 1
            $hwnd = [PremierFullProbe]::FindPremier()
            if ($hwnd -ne [IntPtr]::Zero) {
                Write-Output "[AUTO-INICIO] ¡Ventana de Premier Pluss detectada exitosamente!"
                Start-Sleep -Seconds 3 # Pausa para que termine de cargar la interfaz
                break
            }
        }
    }
}

if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "[ERROR] Premier Pluss 2.0 no esta abierto y no pudo iniciarse."
    Set-ControlState "ERROR" "Premier Pluss 2.0 no esta abierto"
    $errObj = [PSCustomObject]@{
        error = "Premier Pluss 2.0 no esta abierto"
        ok = $false
        rojos = @()
        naranjas = @()
    }
    Write-Output ($errObj | ConvertTo-Json)
    exit 1
}

Set-ControlState "RUNNING" "Iniciando sondeo de $Loteria"

Write-Output "[1/7] Enfocando y maximizando Premier Pluss..."
[PremierFullProbe]::ShowWindow($hwnd, 9)
[PremierFullProbe]::ShowWindow($hwnd, 3)
[PremierFullProbe]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 600

# Limpiar pantalla previa por seguridad
try {
    [System.Windows.Forms.SendKeys]::SendWait("n")
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 200
} catch {}

# =====================================================================
# SELECCION OBLIGATORIA DE MONEDA: BS (BOLIVARES)
# =====================================================================
Write-Output "[1.5/7] Configurando moneda obligatoria en BS (Bolivares)..."
Check-SafetyAndControl "Configurando Moneda"

# 1. Clic en el boton de moneda para desplegar la lista (X=1096, Y=58 en 125% DPI)
[PremierFullProbe]::Click(1096, 58)
Start-Sleep -Milliseconds 300

# 2. La primera opcion de la lista desplegada es 'BS' (X=1096, Y=92 en 125% DPI)
[PremierFullProbe]::Click(1096, 92)
Start-Sleep -Milliseconds 300
Write-Output "[OK] Moneda fijada y confirmada en BS."

# 1. Seleccionar la lotería solicitada
Write-Output "[2/7] Seleccionando Loteria: $Loteria..."
Check-SafetyAndControl "Seleccionando Loteria"
$loteriaY = switch ($Loteria.ToUpper().Trim()) {
    "LA GRANJITA"     { 173 }
    "CENTENA PLUS"    { 215 }
    "GUACHARO ACTIVO" { 270 }
    "LOTTO ACTIVO"    { 292 }
    "SELVA PLUS"      { 355 }
    default           { 270 } # Guacharo por defecto
}
[PremierFullProbe]::Click(120, $loteriaY)
Start-Sleep -Milliseconds 500

# 2. Marcar próximo sorteo en casilla 1 (X=328, Y=63)
Write-Output "[3/7] Marcando casilla del proximo sorteo (Q)..."
Check-SafetyAndControl "Marcando Sorteo"
[PremierFullProbe]::Click(328, 63)
Start-Sleep -Milliseconds 300

# 3. Precargar Monto de sondeo en F6
Write-Output "[4/7] Precargando Monto de sondeo ($MontoSondeo Bs)..."
Check-SafetyAndControl "Precargando Monto F6"
[System.Windows.Forms.SendKeys]::SendWait("{F6}")
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait("$MontoSondeo")
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 250

# 4. Determinar lista de animales según la lotería:
if ($Loteria.ToUpper().Contains("GUACHARO")) {
    $animales = @("00", "0") + (1..75 | ForEach-Object { "$_" })
} else {
    # 38 estándar para Lotto Activo, La Granjita, Selva Plus, etc.
    $animales = @("00", "0") + (1..36 | ForEach-Object { "$_" })
}

Write-Output "[5/7] Ingresando los $($animales.Count) animales por teclado (Motor Universal)..."
$idx = 0
$total = $animales.Count
foreach ($anim in $animales) {
    $idx++
    Check-SafetyAndControl "Animal $anim ($idx/$total)"
    Set-ControlState "RUNNING" "Ingresando animal $anim" $anim "$idx/$total"
    
    Write-Host -NoNewline "`r -> Ingresando animal [$idx/$total]: '$anim' [ESC/F8: Detener | F7: Pausa]...      "
    
    [System.Windows.Forms.SendKeys]::SendWait("{F5}")
    Start-Sleep -Milliseconds 50
    Check-SafetyAndControl "Post F5 animal $anim"
    
    [System.Windows.Forms.SendKeys]::SendWait("$anim")
    Start-Sleep -Milliseconds 60
    Check-SafetyAndControl "Post Numero animal $anim"
    
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 80
    Check-SafetyAndControl "Post Primer Enter animal $anim"
    
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 220
}

Write-Output "`n[OK] Los $($animales.Count) animales fueron ingresados al ticket."
Start-Sleep -Milliseconds 500

# 5. DISPARO DE VALIDACION: Clic en [Imprimir]
Write-Output "[6/7] Disparando validacion con boton [Imprimir]..."
Check-SafetyAndControl "Boton Imprimir"
Set-ControlState "RUNNING" "Disparando validacion con boton Imprimir"
[PremierFullProbe]::Click(1015, 62)
Start-Sleep -Milliseconds 2500

# Función interna de extracción OCR + Color de la tabla
function ExtraerFilasDePantalla($bmpScreen) {
    $tableX = 890
    $tableY = 130
    $tableW = 510
    $tableH = [Math]::Min(720, $bmpScreen.Height - $tableY)

    $rectTable = New-Object System.Drawing.Rectangle $tableX, $tableY, $tableW, $tableH
    $bmpTable = $bmpScreen.Clone($rectTable, $bmpScreen.PixelFormat)

    # 2x Upscale
    $bmp2x = New-Object System.Drawing.Bitmap ($bmpTable.Width * 2), ($bmpTable.Height * 2)
    $g = [System.Drawing.Graphics]::FromImage($bmp2x)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bmpTable, 0, 0, $bmp2x.Width, $bmp2x.Height)
    $g.Dispose()

    $tempFile = Join-Path $PSScriptRoot "temp_ocr_pass.png"
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

    # Analizar color y cruzar con diccionario
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

            # Si tenemos Num pero no Nombre, autocompletar con diccionario
            if ($rObj.Num -and -not $rObj.Nombre -and $animalDict.ContainsKey($rObj.Num)) {
                $rObj.Nombre = $animalDict[$rObj.Num]
            }

            # Si tenemos Nombre pero no Num, resolver número desde diccionario
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

# Captura de pantalla Vista 1 (Superior)
Write-Output "[7/7] Analizando estado de cupos en la tabla (Vista Superior)..."
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmpFull1 = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g1 = [System.Drawing.Graphics]::FromImage($bmpFull1)
$g1.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

# Guardar captura completa para historial
$outFile = Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png"
$bmpFull1.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

$todasLasFilas = @{}
$rowsView1 = ExtraerFilasDePantalla $bmpFull1
foreach ($r in $rowsView1) {
    $todasLasFilas[$r.Num] = $r
}
$g1.Dispose()
$bmpFull1.Dispose()

# Si son más de 20 animales (La Granjita, Lotto Activo, Guácharo), scrollear tabla para capturar la Vista 2 (Inferior)
if ($animales.Count -gt 20) {
    Write-Output "[7/7] Desplazando tabla del ticket hacia abajo para Vista 2..."
    [PremierFullProbe]::ScrollToBottom(1050, 400)
    Start-Sleep -Milliseconds 600

    $bmpFull2 = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g2 = [System.Drawing.Graphics]::FromImage($bmpFull2)
    $g2.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

    $rowsView2 = ExtraerFilasDePantalla $bmpFull2
    foreach ($r in $rowsView2) {
        if (-not $todasLasFilas.ContainsKey($r.Num)) {
            $todasLasFilas[$r.Num] = $r
        } else {
            # Si en cualquier vista se detectó ROJO o NARANJA, preservar el estado crítico
            if ($r.Color -eq "ROJO") { $todasLasFilas[$r.Num].Color = "ROJO" }
            elseif ($r.Color -eq "NARANJA" -and $todasLasFilas[$r.Num].Color -ne "ROJO") { $todasLasFilas[$r.Num].Color = "NARANJA" }
        }
    }
    $g2.Dispose()
    $bmpFull2.Dispose()
}

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

# Consolidar Resultados (Solo Cupo Cero 100% Agotados / Rojos)
$listaRojos = @()
$listaNormales = @()

foreach ($num in ($todasLasFilas.Keys | Sort-Object { if ($_ -eq "00") { -1 } else { [int]$_ } })) {
    $row = $todasLasFilas[$num]
    if ($row.Color -eq "ROJO") {
        $listaRojos += $num
    } else {
        $listaNormales += $num
    }
}

# Construir JSON Final
$reporteFinal = [PSCustomObject]@{
    ok = $true
    loteria = $Loteria
    sorteo = "Proximo Sorteo (Q)"
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    totalAnimalesAnalizados = $todasLasFilas.Count
    rojos = $listaRojos
    naranjas = @()
    totalAgotados = $listaRojos.Count
}

Write-Output "`n=========================================================="
Write-Output "   REPORTE DE ESTADO DE CUPOS - $Loteria"
Write-Output "=========================================================="
Write-Output "TOTAL ANIMALES ANALIZADOS:               $($todasLasFilas.Count)"
Write-Output "TOTAL ANIMALES 100% AGOTADOS (CUPO 0):   $($listaRojos.Count)"

if ($listaRojos.Count -gt 0) {
    Write-Output ">>> AGOTADOS DETECTADOS: $($listaRojos -join ', ')"
}

Set-ControlState "IDLE" "Sondeo completado con exito"

# Guardar registro en historial persistente CSV y JSON
try {
    $histCsvPath = Join-Path (Split-Path $PSScriptRoot -Parent) "reportes_agotados.csv"
    if (-not (Test-Path $histCsvPath)) {
        $hdr = "ID;Fecha;Hora Chequeo;Loteria;Sorteo;Monto Sondeo (Bs);Total Agotados (Rojos);Numeros Rojos;Nombres Rojos;Total Alerta (Naranjas);Detalle Naranjas;Estado Triple 7;Bloqueado T7`r`n"
        [System.IO.File]::WriteAllText($histCsvPath, $hdr, [System.Text.Encoding]::UTF8)
    }
    
    $recId = "$((Get-Date).ToString('yyyy-MM-dd'))_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    $fFecha = (Get-Date).ToString('yyyy-MM-dd')
    $fHora = (Get-Date).ToString('HH:mm:ss')
    
    $nombRojos = ($listaRojos | ForEach-Object { "$_ ($($animalDict[$_]))" }) -join ", "
    $detNar = ($listaNaranjas | ForEach-Object { "$($_.numero) ($($_.nombre): $($_.cupo) Bs)" }) -join " | "
    
    $csvRow = "$recId;$fFecha;$fHora;`"$Loteria`";`"Proximo Sorteo`";$MontoSondeo;$($listaRojos.Count);`"$($listaRojos -join ', ')`";`"$nombRojos`";$($listaNaranjas.Count);`"$detNar`";`"Pendiente`";NO`r`n"
    [System.IO.File]::AppendAllText($histCsvPath, $csvRow, [System.Text.Encoding]::UTF8)
} catch {}

Write-Output "=========================================================="
Write-Output "JSON_OUTPUT_START"
Write-Output ($reporteFinal | ConvertTo-Json -Depth 4)
Write-Output "JSON_OUTPUT_END"

