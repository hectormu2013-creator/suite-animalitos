param(
    [string]$Loteria = "GUACHARO ACTIVO",
    [int]$MontoSondeo = 3000,
    [string]$HoraSorteo = "",
    [switch]$CerrarAlFinalizar
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
    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

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

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    public const uint BM_CLICK = 0x00F5;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static bool DismissExceptionDialog(IntPtr parent) {
        IntPtr btn = IntPtr.Zero;
        EnumChildWindows(parent, (ch, cl) => {
            StringBuilder t = new StringBuilder(256);
            GetWindowText(ch, t, 256);
            string txt = t.ToString().Trim();
            if (txt.Equals("Continuar", StringComparison.OrdinalIgnoreCase) || txt.Equals("&Continuar", StringComparison.OrdinalIgnoreCase)) {
                btn = ch;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (btn != IntPtr.Zero) {
            SendMessage(btn, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
            return true;
        }
        return false;
    }

    public static bool CheckAndDismissAnyExceptionDialog() {
        bool dismissed = false;
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                    if (DismissExceptionDialog(hWnd)) {
                        dismissed = true;
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return dismissed;
    }

    public static IntPtr FindPremier() {
        IntPtr found = IntPtr.Zero;
        CheckAndDismissAnyExceptionDialog();

        // 1. Verificacion rapida por proceso principal
        try {
            Process[] procs = Process.GetProcessesByName("PremierPlussPC20");
            foreach (Process p in procs) {
                IntPtr mw = p.MainWindowHandle;
                if (mw != IntPtr.Zero) {
                    found = mw;
                    break;
                }
            }
        } catch {}

        // 2. Si no, recorrer todas las ventanas buscando proceso PremierPlussPC20
        if (found == IntPtr.Zero) {
            EnumWindows((hWnd, lParam) => {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                try {
                    Process p = Process.GetProcessById((int)pid);
                    if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                        if (DismissExceptionDialog(hWnd)) {
                            return true;
                        }
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
        }

        // 3. Fallback por titulo de ventana si la taquilla cambio de proceso o nombre
        if (found == IntPtr.Zero) {
            EnumWindows((hWnd, lParam) => {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(hWnd, title, 256);
                string t = title.ToString();
                if (t.Contains("Premier Pluss") || t.Contains("PremierPluss") || t.Contains("Taquilla")) {
                    RECT r;
                    GetWindowRect(hWnd, out r);
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    bool vis = IsWindowVisible(hWnd);
                    bool min = IsIconic(hWnd);
                    if (min || (vis && w > 350 && h > 200)) {
                        found = hWnd;
                        return false;
                    }
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

    public static bool ForceForeground(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return false;
        IntPtr fg = GetForegroundWindow();
        if (fg == hWnd) return true;

        uint fgPid = 0;
        uint targetPid = 0;
        uint fgThread = GetWindowThreadProcessId(fg, out fgPid);
        uint targetThread = GetWindowThreadProcessId(hWnd, out targetPid);

        if (fgPid != 0 && fgPid == targetPid) return true;

        uint curThread = GetCurrentThreadId();

        try {
            AttachThreadInput(curThread, fgThread, true);
            AttachThreadInput(curThread, targetThread, true);

            // Simular pulsacion de tecla ALT para liberar la restriccion de SetForegroundWindow de Windows
            keybd_event(0x12, 0, 0, UIntPtr.Zero);
            keybd_event(0x12, 0, 2, UIntPtr.Zero);

            ShowWindow(hWnd, 9); // SW_RESTORE
            ShowWindow(hWnd, 3); // SW_MAXIMIZE
            SetForegroundWindow(hWnd);
        } catch {}
        finally {
            try { AttachThreadInput(curThread, targetThread, false); } catch {}
            try { AttachThreadInput(curThread, fgThread, false); } catch {}
        }

        System.Threading.Thread.Sleep(80);
        IntPtr newFg = GetForegroundWindow();
        if (newFg == hWnd) return true;
        uint newFgPid = 0;
        GetWindowThreadProcessId(newFg, out newFgPid);
        return (newFgPid != 0 && newFgPid == targetPid);
    }

    public static bool IsPremierFocused(IntPtr premierHwnd) {
        if (premierHwnd == IntPtr.Zero) return false;
        IntPtr fg = GetForegroundWindow();
        if (fg == premierHwnd) return true;
        uint fgPid = 0;
        GetWindowThreadProcessId(fg, out fgPid);
        uint targetPid = 0;
        GetWindowThreadProcessId(premierHwnd, out targetPid);
        return (fgPid != 0 && fgPid == targetPid);
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
        if ($hwnd -ne [IntPtr]::Zero) {
            [PremierFullProbe]::ForceForeground($hwnd) | Out-Null
            try {
                [System.Windows.Forms.SendKeys]::SendWait("n")
                Start-Sleep -Milliseconds 150
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            } catch {}
        }
        exit 99
    }

    # 2. Comprobar orden de detencion desde el archivo de control / panel web
    $action = Get-ControlAction
    if ($action -eq "STOP") {
        Write-Output "`n`n[CONTROL] Detencion total solicitada por el usuario desde el panel."
        Set-ControlState "STOPPED" "Detenido desde panel web"
        if ($hwnd -ne [IntPtr]::Zero) {
            [PremierFullProbe]::ForceForeground($hwnd) | Out-Null
            try {
                [System.Windows.Forms.SendKeys]::SendWait("n")
                Start-Sleep -Milliseconds 150
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            } catch {}
        }
        exit 99
    }

    # 3. Comprobar solicitud de pausa manual (por tecla F7 o por panel web)
    $pauseTriggered = ($action -eq "PAUSE") -or [PremierFullProbe]::IsPauseHotkeyPressed()
    if ($pauseTriggered) {
        Write-Output "`n[PAUSA ACTIVADA] Automatizacion en PAUSA ($stepName)."
        Write-Output " -> Presiona [F7] o pulsa 'Continuar' en el panel web para reanudar."
        Write-Output " -> Presiona [ESC] o [F8] para abortar por completo."
        Set-ControlState "PAUSED" "Pausado en: $stepName"
        Start-Sleep -Milliseconds 500

        while ($true) {
            Start-Sleep -Milliseconds 200
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
                [PremierFullProbe]::ForceForeground($hwnd) | Out-Null
                Start-Sleep -Milliseconds 400
                break
            }
        }
    }
}

Write-Output "=========================================================="
Write-Output "  SONDEO Y EXTRACCION DE AGOTADOS - $Loteria"
Write-Output "  SEGURIDAD ACTIVA: [ESC/F8] Detener | [F7] Pausar/Continuar"
Write-Output "=========================================================="

# Deteccion directa de la taquilla abierta por el usuario en el escritorio
$hwnd = [PremierFullProbe]::FindPremier()

if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "[ERROR] Premier Pluss 2.0 no esta abierto en el escritorio."
    Write-Output "[AVISO] Por favor abre Premier Pluss e inicia sesion en la taquilla. El sistema se encargara de los sondeos y bloqueos automaticamente."
    Set-ControlState "IDLE" "Premier Pluss no detectado - Abrelo en el escritorio"
    $errObj = [PSCustomObject]@{
        error = "Premier Pluss 2.0 no esta abierto en el escritorio"
        ok = $false
        rojos = @()
        naranjas = @()
    }
    Write-Output "JSON_OUTPUT_START"
    Write-Output ($errObj | ConvertTo-Json -Compress)
    Write-Output "JSON_OUTPUT_END"
    exit 1
}

Set-ControlState "RUNNING" "Iniciando sondeo de $Loteria"

Write-Output "[1/7] Enfocando y maximizando Premier Pluss (Taquilla)..."
[PremierFullProbe]::ShowWindow($hwnd, 9)
[PremierFullProbe]::ShowWindow($hwnd, 3)
[PremierFullProbe]::ForceForeground($hwnd) | Out-Null
Start-Sleep -Milliseconds 800

# Limpieza inicial segura: descartar excepciones previas y cancelar cualquier menu emergente con ESC
[PremierFullProbe]::CheckAndDismissAnyExceptionDialog() | Out-Null
try {
    [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
    Start-Sleep -Milliseconds 200
} catch {}

# =====================================================================
# ASEGURAR SIEMPRE PESTAÑA ANIMALITOS (F2)
# =====================================================================
Write-Output "[1.2/7] Asegurando pestana ANIMALITOS con tecla F2..."
try {
    [System.Windows.Forms.SendKeys]::SendWait("{F2}")
    Start-Sleep -Milliseconds 300
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

# 1. Seleccionar la loteria solicitada
Write-Output "[2/7] Seleccionando Loteria: $Loteria..."
Check-SafetyAndControl "Seleccionando Loteria"

# Coordenadas Y operativas comprobadas:
# LA GRANJITA:           173
# GUACHARITO MILLONARIO: 248
# GUACHARO ACTIVO:       270
# LOTTO ACTIVO:          292
# SELVA PLUS:            355
$loteriaY = switch -Wildcard ($Loteria.ToUpper().Trim()) {
    "*MILLONARIO*"    { 248 }
    "*GRANJITA*"      { 173 }
    "CENTENA PLUS"    { 215 }
    "*LOTTO ACTIVO*"  { 292 }
    "*GUACHARO*"      { 270 }
    "*SELVA PLUS*"    { 355 }
    default           { 270 } # Guacharo por defecto
}
[PremierFullProbe]::Click(120, $loteriaY)
Start-Sleep -Milliseconds 500

# 2. Marcar proximo sorteo en casilla 1 (X=328, Y=63 para todas las loterias)
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

# 4. Determinar lista de animales segun la loteria:
if ($Loteria.ToUpper().Contains("MILLONARIO")) {
    # Guacharito Millonario: 101 animales (00, 0, 1..99)
    $animales = @("00", "0") + (1..99 | ForEach-Object { "$_" })
} elseif ($Loteria.ToUpper().Contains("GUACHARO")) {
    # Guacharo Activo: 77 animales (00, 0, 1..75)
    $animales = @("00", "0") + (1..75 | ForEach-Object { "$_" })
} else {
    # 38 estandar para Lotto Activo, La Granjita, Selva Plus, etc.
    $animales = @("00", "0") + (1..36 | ForEach-Object { "$_" })
}

Write-Output "[5/7] Ingresando los $($animales.Count) animales por teclado (Motor Universal Rapido)..."
$idx = 0
$total = $animales.Count
foreach ($anim in $animales) {
    $idx++
    Check-SafetyAndControl "Animal $anim ($idx/$total)"
    if ($idx % 5 -eq 1 -or $idx -eq $total) {
        Set-ControlState "RUNNING" "Ingresando animal $anim" $anim "$idx/$total"
    }
    
    Write-Host -NoNewline "`r -> Ingresando animal [$idx/$total]: '$anim' [ESC/F8: Detener | F7: Pausa]...      "
    
    [System.Windows.Forms.SendKeys]::SendWait("{F5}")
    Start-Sleep -Milliseconds 35
    
    [System.Windows.Forms.SendKeys]::SendWait("$anim")
    Start-Sleep -Milliseconds 40
    
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 50
    
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 120
}

Write-Output "`n[OK] Los $($animales.Count) animales fueron ingresados al ticket."
Start-Sleep -Milliseconds 500

# 5. DISPARO DE VALIDACION: Clic en [Imprimir]
Write-Output "[6/7] Disparando validacion con boton [Imprimir]..."
Check-SafetyAndControl "Boton Imprimir"
Set-ControlState "RUNNING" "Disparando validacion con boton Imprimir"
[PremierFullProbe]::Click(1015, 62)
Start-Sleep -Milliseconds 2500

# Funcion interna de extraccion OCR + Color de la tabla
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

            # Si tenemos Nombre pero no Num, resolver numero desde diccionario
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

# Si son mas de 20 animales (La Granjita, Lotto Activo, Guacharo), scrollear tabla para capturar la Vista 2 (Inferior)
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
            # Si en cualquier vista se detecto ROJO o NARANJA, preservar el estado critico
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
try {
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 250
    [System.Windows.Forms.SendKeys]::SendWait("n")
    Start-Sleep -Milliseconds 350
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 200
} catch {}
[PremierFullProbe]::CheckAndDismissAnyExceptionDialog() | Out-Null

Write-Output "[SEGURIDAD OK] Pantalla restablecida a 0 jugadas."

# Comprobar si corresponde cierre limpio al finalizar el ultimo sorteo del dia
if ($CerrarAlFinalizar) {
    Write-Output "`n[CIERRE DE SESION] Ultimo sorteo del dia finalizado. Cerrando Premier Pluss de forma limpia..."
    try {
        $p = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue
        if ($p) {
            $p.CloseMainWindow() | Out-Null
            Start-Sleep -Seconds 2
        }
    } catch {}
} else {
    Write-Output "`n[SESION PERMANENTE] Premier Pluss se mantiene abierto y listo para los proximos sorteos del dia."
}

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
    sorteo = if ($HoraSorteo) { $HoraSorteo } else { "Proximo Sorteo" }
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

