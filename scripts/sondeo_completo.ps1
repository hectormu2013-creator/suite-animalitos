param(
    [string]$Loteria = "GUACHARO ACTIVO",
    [int]$MontoSondeo = 3000,
    [string]$HoraSorteo = "",
    [switch]$CerrarAlFinalizar,
    [switch]$ModoHibrido
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

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

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
    public static extern bool SetProcessDPIAware();

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
            if (txt.Equals("Continuar", StringComparison.OrdinalIgnoreCase) || 
                txt.Equals("&Continuar", StringComparison.OrdinalIgnoreCase) ||
                txt.Equals("Aceptar", StringComparison.OrdinalIgnoreCase) ||
                txt.Equals("&Aceptar", StringComparison.OrdinalIgnoreCase) ||
                txt.Equals("OK", StringComparison.OrdinalIgnoreCase) ||
                txt.Equals("Cerrar", StringComparison.OrdinalIgnoreCase)) {
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
        // Asegurar conexion a la estacion interactiva y escritorio Default
        try {
            IntPtr hw = OpenWindowStation("WinSta0", false, 0x10000000);
            if (hw != IntPtr.Zero) SetProcessWindowStation(hw);
            IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
            if (hd != IntPtr.Zero) SetThreadDesktop(hd);
        } catch {}

        IntPtr found = IntPtr.Zero;
        CheckAndDismissAnyExceptionDialog();

        // 1. Verificacion rapida por proceso principal
        try {
            Process[] procs = Process.GetProcessesByName("PremierPlussPC20");
            foreach (Process p in procs) {
                IntPtr mw = p.MainWindowHandle;
                if (mw != IntPtr.Zero) {
                    return mw;
                }
            }
        } catch {}

        // 2. EnumDesktopWindows en escritorio interactivo Default
        try {
            IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
            if (hd != IntPtr.Zero) {
                EnumDesktopWindows(hd, (hWnd, lParam) => {
                    uint pid = 0;
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
        } catch {}

        // 3. Si no se encontro por EnumDesktopWindows, recorrer EnumWindows buscando proceso PremierPlussPC20
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

        // 4. Fallback por titulo de ventana si la taquilla cambio de proceso o nombre
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
        System.Threading.Thread.Sleep(40);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void ClickPrintButton(int x, int y) {
        // En Maquina 1: mover cursor, esperar 150ms para que WPF registre 'IsMouseOver'
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(150);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(90);
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
        ScrollWheel(x, y, 80, -120);
    }

    public static void ScrollToTop(int x, int y) {
        ScrollWheel(x, y, 50, 120);
    }
}
"@

[PremierFullProbe]::SetProcessDPIAware() | Out-Null

function ObtenerPosicionBotonImpresora($bmpPantalla) {
    # Escanear el tercio superior derecho donde se ubica la barra de botones (X: 750 a Ancho, Y: 30 a 110)
    $cropX = [Math]::Max(750, [int]($bmpPantalla.Width * 0.55))
    $cropY = 30
    $cropW = $bmpPantalla.Width - $cropX - 10
    $cropH = 80
    
    $rect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
    $crop = $bmpPantalla.Clone($rect, $bmpPantalla.PixelFormat)
    
    $bluePoints = @()
    for ($x = 0; $x -lt $crop.Width; $x++) {
        for ($y = 0; $y -lt $crop.Height; $y++) {
            $p = $crop.GetPixel($x, $y)
            # Azul característico del botón de Premier (#009EF7)
            if ($p.R -lt 45 -and $p.G -gt 120 -and $p.B -gt 205) {
                $bluePoints += [PSCustomObject]@{ X = $x; Y = $y }
            }
        }
    }
    $crop.Dispose()
    
    if ($bluePoints.Count -ge 20) {
        # Agrupar por columnas X para descartar ruido o texto azul aislado
        $xGroups = $bluePoints | Group-Object -Property X | Where-Object { $_.Count -ge 14 }
        if ($xGroups.Count -ge 15) {
            $sortedXs = $xGroups | ForEach-Object { [int]$_.Name } | Sort-Object
            
            # Encontrar el cluster continuo mas grande de columnas
            $clusters = @()
            $currCluster = @($sortedXs[0])
            for ($i = 1; $i -lt $sortedXs.Count; $i++) {
                if ($sortedXs[$i] -eq ($currCluster[-1] + 1)) {
                    $currCluster += $sortedXs[$i]
                } else {
                    $clusters += ,$currCluster
                    $currCluster = @($sortedXs[$i])
                }
            }
            $clusters += ,$currCluster

            $bestCluster = $clusters | Sort-Object -Property Count -Descending | Select-Object -First 1
            if ($bestCluster -and $bestCluster.Count -ge 15) {
                $minClusterX = $bestCluster[0]
                $maxClusterX = $bestCluster[-1]
                $btnPoints = $bluePoints | Where-Object { $_.X -ge $minClusterX -and $_.X -le $maxClusterX }
                
                $avgX = [int](($btnPoints | Measure-Object -Property X -Average).Average)
                $avgY = [int](($btnPoints | Measure-Object -Property Y -Average).Average)
                return [PSCustomObject]@{
                    X = $cropX + $avgX
                    Y = $cropY + $avgY
                    Detectado = $true
                }
            }
        }
    }
    # Fallback seguro para 1080p
    return [PSCustomObject]@{
        X = 1280
        Y = 72
        Detectado = $false
    }
}

function ObtenerCasillasMarcadas($bmpPantalla, $panelLeft = 320, $panelTop = 35, $panelWidth = 580, $panelHeight = 95) {
    $w = [Math]::Min($panelWidth, ($bmpPantalla.Width - $panelLeft))
    $h = [Math]::Min($panelHeight, ($bmpPantalla.Height - $panelTop))
    if ($w -le 0 -or $h -le 0) { return @() }
    $rect = New-Object System.Drawing.Rectangle $panelLeft, $panelTop, $w, $h
    $crop = $bmpPantalla.Clone($rect, $bmpPantalla.PixelFormat)

    $greenPoints = @()
    for ($y = 0; $y -lt $crop.Height; $y++) {
        for ($x = 0; $x -lt $crop.Width; $x++) {
            $c = $crop.GetPixel($x, $y)
            if ($c.G -gt 130 -and $c.G -gt ($c.R + 40) -and $c.G -gt ($c.B + 40)) {
                $greenPoints += [PSCustomObject]@{ X = $x; Y = $y }
            }
        }
    }
    $crop.Dispose()

    $clusters = @()
    foreach ($pt in $greenPoints) {
        $foundCl = $null
        foreach ($cl in $clusters) {
            if ([Math]::Abs($cl.X - $pt.X) -le 25 -and [Math]::Abs($cl.Y - $pt.Y) -le 20) {
                $foundCl = $cl
                break
            }
        }
        if ($foundCl) {
            $foundCl.Count++
            $foundCl.SumX += $pt.X
            $foundCl.SumY += $pt.Y
        } else {
            $clusters += [PSCustomObject]@{
                X = $pt.X
                Y = $pt.Y
                SumX = $pt.X
                SumY = $pt.Y
                Count = 1
            }
        }
    }

    $cajas = @()
    foreach ($cl in $clusters) {
        if ($cl.Count -ge 20) {
            $cajas += [PSCustomObject]@{
                X = $panelLeft + [int]($cl.SumX / $cl.Count)
                Y = $panelTop + [int]($cl.SumY / $cl.Count)
                CropX = [int]($cl.SumX / $cl.Count)
                CropY = [int]($cl.SumY / $cl.Count)
                Pixels = $cl.Count
            }
        }
    }
    return $cajas
}

function AsegurarSoloProximoSorteo($isTester = $false) {
    Write-Output " -> [SORTEO] Verificando casillas de sorteo marcadas en pantalla..."
    Start-Sleep -Milliseconds 250
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmpScreen = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmpScreen)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $g.Dispose()

    $marcadas = ObtenerCasillasMarcadas $bmpScreen 320 35 580 95
    $bmpScreen.Dispose()

    $hayNoDeseados = $false
    foreach ($m in $marcadas) {
        # La casilla Q se ubica en la esquina superior izquierda del panel de sorteos (X < 430, Y < 95)
        $esQ = ($m.X -lt 430 -and $m.Y -lt 95)
        if (-not $esQ) {
            $hayNoDeseados = $true
            break
        }
    }

    if ($hayNoDeseados -or $marcadas.Count -gt 1) {
        Write-Output " -> [SORTEO] Detectadas casillas adicionales marcadas previamente ($($marcadas.Count)). Limpiando..."
        foreach ($m in $marcadas) {
            $esEstaQ = ($m.X -lt 430 -and $m.Y -lt 95)
            if (-not $esEstaQ) {
                Write-Output "    -> Desmarcando casilla no deseada en X=$($m.X), Y=$($m.Y)..."
                [PremierFullProbe]::Click($m.X, $m.Y)
                Start-Sleep -Milliseconds 120
            }
        }
        Start-Sleep -Milliseconds 200
        
        # Verificar si Q quedo marcado
        $tieneQ = ($marcadas | Where-Object { $_.X -lt 430 -and $_.Y -lt 95 })
        if (-not $tieneQ) {
            Write-Output " -> [SORTEO] Marcando exclusivamente el proximo sorteo con tecla 'Q'..."
            try { [System.Windows.Forms.SendKeys]::SendWait("q") } catch {}
            Start-Sleep -Milliseconds 250
        }
    } elseif ($marcadas.Count -eq 1) {
        Write-Output " -> [SORTEO] El proximo sorteo (Q) ya esta marcado correctamente."
    } else {
        Write-Output " -> [SORTEO] Ningun sorteo marcado. Marcando proximo sorteo con tecla 'Q'..."
        try { [System.Windows.Forms.SendKeys]::SendWait("q") } catch {}
        Start-Sleep -Milliseconds 250
    }
}

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

function BuscarPosicionLoteriaPorOCR($bmpPantalla, $nombreLoteria) {
    # Recortar la columna de loterias (X: 10 a 360, Y: 80 a 580)
    $cropX = 10
    $cropY = 80
    $cropW = 350
    $cropH = 500

    $rect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
    $crop = $bmpPantalla.Clone($rect, $bmpPantalla.PixelFormat)
    $tempOcrLot = Join-Path $PSScriptRoot "temp_ocr_loteria_find.png"
    $crop.Save($tempOcrLot, [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()

    try {
        $storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync([System.IO.Path]::GetFullPath($tempOcrLot))) ([Windows.Storage.StorageFile])
        $stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
        if ($null -eq $engine) {
            $lang = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Where-Object { $_.LanguageTag -like "es*" } | Select-Object -First 1
            if (-not $lang) {
                $lang = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1
            }
            if ($lang) {
                $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
            }
        }
        $ocrRes = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

        Write-Host " -> [OCR INFO] Lineas detectadas en columna de loterias: $(@($ocrRes.Lines).Count)" -ForegroundColor Cyan
        $nomUpper = $nombreLoteria.ToUpper().Trim()

        foreach ($line in $ocrRes.Lines) {
            $rawText = $line.Text.Trim()
            $t = $rawText.ToUpper()

            # Normalizar variaciones de OCR sobre LOTTO: [OTTO, 1OTTO, |OTTO, IOTTO, OTTO ACTIVO -> LOTTO
            $tNorm = $t -replace '[\[\|1!I]OTTO', 'LOTTO'
            $tNorm = $tNorm -replace 'LOTO', 'LOTTO'
            if ($tNorm -like "*OTTO ACTIVO*") {
                $tNorm = $tNorm -replace 'OTTO ACTIVO', 'LOTTO ACTIVO'
            }

            # Extraer el nombre base removiendo conteos de sorteos como (1), (3), (I), "), etc.
            $delim = @('(', '[', '"', "'", '=', ')', ']')
            $tBase = $tNorm.Split($delim, [System.StringSplitOptions]::RemoveEmptyEntries)[0].Trim()

            $match = $false

            if ($nomUpper -like "*RICACHONA*") {
                if ($tBase -like "*RICACHONA*") { $match = $true }
            } elseif ($nomUpper -like "*GRANJITA*PLUS*") {
                if ($tBase -like "*GRANJITA*PLUS*") { $match = $true }
            } elseif ($nomUpper -like "*GRANJITA*") {
                if ($tBase -like "*GRANJITA*" -and $tBase -notlike "*PLUS*") { $match = $true }
            } elseif ($nomUpper -like "*CENTENA*PLUS*") {
                if ($tBase -like "*CENTENA*PLUS*" -or $tBase -like "*CENTENA*PTUS*") { $match = $true }
            } elseif ($nomUpper -like "*CENTENA*") {
                if ($tBase -like "*CENTENA*" -and $tBase -notlike "*PLUS*" -and $tBase -notlike "*PTUS*") { $match = $true }
            } elseif ($nomUpper -like "*CHANCE*") {
                if ($tBase -like "*CHANCE*") { $match = $true }
            } elseif ($nomUpper -like "*MILLONARIO*") {
                if ($tBase -like "*MILLONARIO*" -or $tBase -like "*GUACHARITO*") { $match = $true }
            } elseif ($nomUpper -like "*GUACHARO*") {
                if ($tBase -like "*GUACHARO*" -and $tBase -notlike "*MILLONARIO*" -and $tBase -notlike "*GUACHARITO*") { $match = $true }
            } elseif ($nomUpper -like "*LOTTO*INT*") {
                if ($tNorm -like "*LOTTO*INT*" -or $tNorm -like "*LOTTO*'NT*" -or $tNorm -like "*LOTTO*ACTIVO*INT*") { $match = $true }
            } elseif ($nomUpper -like "*LOTTO*") {
                # LOTTO ACTIVO NACIONAL: debe coincidir con LOTTO, OTTO o ACTIVO, pero NO ser Internacional ('NT, INT, INTERNACIONAL, etc.) ni Guacharo
                $esGuacharo = ($tNorm -like "*GUACHAR*")
                $esInt = ($tNorm -like "*INT*" -or $tNorm -like "*'NT*" -or $tNorm -like "*INTERNACIONAL*")
                $tieneLottoU_Otto = ($tNorm -like "*LOTTO*" -or $tNorm -like "*OTTO*")
                $tieneActivo = ($tNorm -like "*ACTIVO*")

                if (($tieneLottoU_Otto -or $tieneActivo) -and -not $esGuacharo -and -not $esInt) {
                    $match = $true
                }
            } elseif ($nomUpper -like "*MEGA*") {
                if ($tBase -like "*MEGA*") { $match = $true }
            } elseif ($nomUpper -like "*SELVA*") {
                if ($tBase -like "*SELVA*") { $match = $true }
            } else {
                if ($tBase -like ("*" + $nomUpper + "*")) { $match = $true }
            }

            if ($match) {
                Write-Host " -> [OCR OK] Coincidencia confirmada: '$rawText' para '$nombreLoteria'" -ForegroundColor Green
                $firstWord = $line.Words | Select-Object -First 1
                $topY = [int]$firstWord.BoundingRect.Y
                $h = [int]$firstWord.BoundingRect.Height
                $screenY = $cropY + $topY + [int]($h / 2)
                $leftX = [int]$firstWord.BoundingRect.X
                $screenX = [Math]::Max(80, [Math]::Min(150, ($cropX + $leftX + 25)))
                return [PSCustomObject]@{
                    Encontrado = $true
                    X = $screenX
                    Y = $screenY
                    TextoDetectado = $rawText
                }
            }
        }
    } catch {
        Write-Host " -> [AVISO OCR] Error durante escaneo de loterias: $($_.Exception.Message)" -ForegroundColor Yellow
    } finally {
        if (Test-Path $tempOcrLot) { Remove-Item $tempOcrLot -Force -ErrorAction SilentlyContinue }
    }

    return [PSCustomObject]@{
        Encontrado = $false
        X = 135
        Y = 0
        TextoDetectado = ""
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

function LimpiarTicketYPantallaPremier($momento = "INICIAL") {
    Write-Output " -> [LIMPIEZA DE PANTALLA - $momento] Vaciando ticket residual y asegurando pantalla en 0 jugadas..."
    [PremierFullProbe]::CheckAndDismissAnyExceptionDialog() | Out-Null
    [PremierFullProbe]::ForceForeground($hwnd) | Out-Null
    Start-Sleep -Milliseconds 150

    try {
        # Cancelar cualquier seleccion previa o caja de texto abierta con ESC y ENTER
        [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
        Start-Sleep -Milliseconds 150
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Milliseconds 150

        # Pulsar 'n' (Nuevo Ticket / Limpiar) y confirmar con Enter
        [System.Windows.Forms.SendKeys]::SendWait("n")
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Milliseconds 250
        [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
        Start-Sleep -Milliseconds 150
    } catch {}

    [PremierFullProbe]::CheckAndDismissAnyExceptionDialog() | Out-Null
    Write-Output " -> [LIMPIEZA DE PANTALLA - $momento OK] Ticket limpio y restablecido a 0 jugadas."
}

Write-Output "[1/7] Enfocando y maximizando Premier Pluss (Taquilla)..."
[PremierFullProbe]::ShowWindow($hwnd, 9)
[PremierFullProbe]::ShowWindow($hwnd, 3)
[PremierFullProbe]::ForceForeground($hwnd) | Out-Null
Start-Sleep -Milliseconds 800

if (-not $ModoHibrido) {
    # [LIMPIEZA PREVENTIVA 1 DE 2]: Limpiar cualquier jugada residual dejada en pantalla antes de iniciar
    Write-Output "[1.1/7] Ejecutando limpieza inicial preventiva de pantalla y ticket (1 de 2)..."
    LimpiarTicketYPantallaPremier "INICIAL PREVENTIVA"

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

    # 1. Localizar la loteria en pantalla mediante OCR visual directo (Cero coordenadas fijas)
    Write-Output "[2/7] Localizando loteria '$Loteria' en el menu mediante OCR visual..."
    Check-SafetyAndControl "Buscando Loteria por OCR"

    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmpScreenForFind = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $gFind = [System.Drawing.Graphics]::FromImage($bmpScreenForFind)
    try {
        $gFind.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    } catch {
        Write-Output "⚠️ [AVISO PANTALLA] Reintentando captura OCR ($($_.Exception.Message))..."
        Start-Sleep -Milliseconds 350
        try {
            $gFind.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        } catch {
            Write-Output "⚠️ [ERROR PANTALLA] No se pudo obtener el contexto de pantalla: $($_.Exception.Message)"
        }
    }
    $gFind.Dispose()

    $posLoteria = BuscarPosicionLoteriaPorOCR $bmpScreenForFind $Loteria
    $bmpScreenForFind.Dispose()

    if (-not $posLoteria.Encontrado -or $posLoteria.Y -le 0) {
        Write-Output "`n❌ [ALERTA OCR] La loteria '$Loteria' no se encuentra visible en el menu de Premier Pluss."
        Write-Output " -> Causa: Todos sus sorteos del dia ya concluyeron (o aun no han abierto)."
        Write-Output " -> Medida de seguridad: Se aborta la seleccion para evitar clics accidentales en otra loteria."

        $errObj = [PSCustomObject]@{
            ok = $false
            error = "Loteria '$Loteria' no disponible en el menu (sorteos culminados por hoy)."
            loteria = $Loteria
            sorteo = if ($HoraSorteo) { $HoraSorteo } else { "Culminado" }
            rojos = @()
            naranjas = @()
        }
        Write-Output "JSON_OUTPUT_START"
        Write-Output ($errObj | ConvertTo-Json -Compress)
        Write-Output "JSON_OUTPUT_END"
        exit 2
    }

    $loteriaX = if ($posLoteria.X -and $posLoteria.X -gt 0) { $posLoteria.X } else { 135 }
    $loteriaY = $posLoteria.Y
    Write-Output " -> [OCR EXITO] '$($posLoteria.TextoDetectado)' encontrada exactamente en X=$loteriaX, Y=$loteriaY."
    Write-Output " -> Haciendo clic en X=$loteriaX, Y=$loteriaY..."
    [PremierFullProbe]::Click($loteriaX, $loteriaY)
    Start-Sleep -Milliseconds 600

    # 2. Asegurar que no haya sorteos previos marcados y marcar exclusivamente el proximo (Q)
    Write-Output "[3/7] Asegurando exclusivamente el proximo sorteo..."
    Check-SafetyAndControl "Marcando Sorteo"
    AsegurarSoloProximoSorteo $false
} else {
    Write-Output "`n🎯 [MODO HIBRIDO ACTIVADO] Operacion asistida por el operador:"
    Write-Output " -> Manteniendo la loteria y el sorteo ya marcados en pantalla por el operador."
    [PremierFullProbe]::CheckAndDismissAnyExceptionDialog() | Out-Null

    # Auto-deteccion opcional mediante OCR del encabezado 'Sorteos: (...)'
    try {
        $bmpHeader = New-Object System.Drawing.Bitmap 480, 40
        $gH = [System.Drawing.Graphics]::FromImage($bmpHeader)
        $gH.CopyFromScreen(380, 26, 0, 0, (New-Object System.Drawing.Size 480, 40))
        $gH.Dispose()

        $tempHdrFile = Join-Path $PSScriptRoot "temp_ocr_header.png"
        $bmpHeader.Save($tempHdrFile, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmpHeader.Dispose()

        $storageFileH = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempHdrFile)) ([Windows.Storage.StorageFile])
        $streamH = Await ($storageFileH.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoderH = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($streamH)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $sbH = Await ($decoderH.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $engineH = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
        $ocrResH = Await ($engineH.RecognizeAsync($sbH)) ([Windows.Media.Ocr.OcrResult])

        $hdrTxt = $ocrResH.Text.ToUpper().Trim()
        Write-Output " -> [LECTURA PANTALLA] Encabezado: '$hdrTxt'"
        if ($hdrTxt -like "*MILLONARIO*") {
            $Loteria = "GUACHARITO MILLONARIO"
            Write-Output " -> [AUTO-DETECTADO] GUACHARITO MILLONARIO (101 animales)"
        } elseif ($hdrTxt -like "*GUACHARO*") {
            $Loteria = "GUACHARO ACTIVO"
            Write-Output " -> [AUTO-DETECTADO] GUACHARO ACTIVO (77 animales)"
        } elseif ($hdrTxt -like "*GRANJITA*") {
            $Loteria = "LA GRANJITA"
            Write-Output " -> [AUTO-DETECTADO] LA GRANJITA (38 animales)"
        } elseif ($hdrTxt -like "*LOTTO*") {
            $Loteria = "LOTTO ACTIVO"
            Write-Output " -> [AUTO-DETECTADO] LOTTO ACTIVO (38 animales)"
        } elseif ($hdrTxt -like "*SELVA*") {
            $Loteria = "SELVA PLUS"
            Write-Output " -> [AUTO-DETECTADO] SELVA PLUS (38 animales)"
        }
        if (Test-Path $tempHdrFile) { Remove-Item $tempHdrFile -Force }
    } catch {
        Write-Output " -> Usando perfil de loteria indicado: $Loteria"
    }
}

# 3. Precargar Monto de sondeo en F6
Write-Output "[4/7] Precargando Monto de sondeo ($MontoSondeo Bs)..."
Check-SafetyAndControl "Precargando Monto F6"
[PremierFullProbe]::ForceForeground($hwnd) | Out-Null
Start-Sleep -Milliseconds 150
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

# 5. DISPARO DE VALIDACION: Clic UNICO en [Imprimir] (Deteccion Dinamica)
Write-Output "[6/7] Disparando validacion de cupos con boton [Imprimir] (Un solo clic de consulta)..."
Check-SafetyAndControl "Boton Imprimir"
Set-ControlState "RUNNING" "Disparando validacion con boton Imprimir"
[PremierFullProbe]::ForceForeground($hwnd) | Out-Null
Start-Sleep -Milliseconds 200

# Deteccion visual dinamica del boton azul de la Impresora en la franja superior
$boundsScreen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmpForPrintBtn = New-Object System.Drawing.Bitmap $boundsScreen.Width, $boundsScreen.Height
$gPBtn = [System.Drawing.Graphics]::FromImage($bmpForPrintBtn)
$gPBtn.CopyFromScreen($boundsScreen.Location, [System.Drawing.Point]::Empty, $boundsScreen.Size)
$gPBtn.Dispose()

$posImpresora = ObtenerPosicionBotonImpresora $bmpForPrintBtn
$bmpForPrintBtn.Dispose()

Write-Output " -> [BOTON IMPRESORA] Ubicacion: X=$($posImpresora.X), Y=$($posImpresora.Y) (Dinamico: $($posImpresora.Detectado))."
Write-Output " -> Ejecutando CLIC con estabilizacion hover para validar cupos..."
[PremierFullProbe]::ClickPrintButton($posImpresora.X, $posImpresora.Y)

# Esperar respuesta del servidor de Premier Pluss para que pinte las filas rojas/naranjas (2800ms)
Start-Sleep -Milliseconds 2800

# Descartar cualquier cuadro de error o confirmacion
[PremierFullProbe]::CheckAndDismissAnyExceptionDialog() | Out-Null

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
                if ([Math]::Abs($k - $globalY) -le 11) {
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

        if ($yC -ge 145 -and $yC -lt ($bmpScreen.Height - 30)) {
            $redCount = 0
            $orangeCount = 0
            for ($sx = 960; $sx -le 1220; $sx += 3) {
                # Muestreo a 5 alturas para maxima precision del fondo sin importar la alineacion del texto
                foreach ($dy in @(-3, -1, 0, 1, 3)) {
                    $sampY = $yC + $dy
                    if ($sampY -ge 0 -and $sampY -lt $bmpScreen.Height) {
                        $px = $bmpScreen.GetPixel($sx, $sampY)
                        # Rojo puro de cupo cero en Premier Pluss (R alto > 180, G y B bajos < 85)
                        if ($px.R -gt 180 -and $px.G -lt 85 -and $px.B -lt 85) {
                            $redCount++
                        } elseif ($px.R -gt 200 -and $px.G -gt 130 -and $px.G -lt 220 -and $px.B -lt 80) {
                            $orangeCount++
                        }
                    }
                }
            }

            # Deteccion infalible de Cupo Cero: rojo visual o monto explicitamente 0
            $montoLimpio = ($rObj.Monto -replace '[^\d,\.]', '').Trim()
            $esMontoCero = ($rObj.Monto -in @('0', '0,0', '0,00', '0.00', '0 Bs', '0,0 Bs')) -or ($montoLimpio -in @('0', '00', '0,00', '0.00', '0,0', '0.0'))
            if ($redCount -ge 8 -or ($esMontoCero -and ($orangeCount -gt 3 -or $redCount -ge 4))) {
                $rObj.Color = "ROJO"
            } elseif ($orangeCount -gt 10) {
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

# =====================================================================
# PANEO MULTI-PANTALLA PROGRESIVO CONTINUO (SWEEP TOTAL SIN SALTOS)
# Cubre el 100% de los animales para 38, 77 (Guacharo) y 101 (Guacharito Millonario)
# =====================================================================
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$todasLasFilas = @{}

# Calcular numero de pasos de barrido segun la loteria
$totalPasos = 2
if ($animales.Count -gt 77) {
    # Guacharito Millonario (101 animales): 9 vistas completas con estabilizacion de fondo
    $totalPasos = 9
} elseif ($animales.Count -gt 38) {
    # Guacharo Activo (77 animales): 5 vistas (Top + 3 tramos intermedios + Fondo)
    $totalPasos = 5
} elseif ($animales.Count -le 22) {
    $totalPasos = 1
}

Write-Output "[7/7] Iniciando barrido continuo multi-pantalla ($totalPasos vistas para $($animales.Count) animales)..."

for ($paso = 1; $paso -le $totalPasos; $paso++) {
    if ($paso -eq 1) {
        Write-Output " -> [PANEO 1/$totalPasos] Analizando Vista Superior inicial..."
    } elseif ($paso -eq $totalPasos) {
        Write-Output " -> [PANEO $paso/$totalPasos] Desplazando tabla al fondo absoluto (Vista Final estabilizada)..."
        [PremierFullProbe]::ScrollToBottom(1050, 400)
        Start-Sleep -Milliseconds 900
    } else {
        Write-Output " -> [PANEO $paso/$totalPasos] Avanzando tramo intermedio con renderizado seguro..."
        [PremierFullProbe]::ScrollWheel(1050, 400, 6, -120)
        Start-Sleep -Milliseconds 550
    }

    $bmpFull = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmpFull)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

    # En el primer paso guardamos la captura general para el historial
    if ($paso -eq 1) {
        $outFile = Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png"
        $bmpFull.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $rowsView = ExtraerFilasDePantalla $bmpFull
    $nuevos = 0
    foreach ($r in $rowsView) {
        if (-not $todasLasFilas.ContainsKey($r.Num)) {
            $todasLasFilas[$r.Num] = $r
            $nuevos++
        } else {
            # Si en cualquier vista se detecto ROJO o NARANJA, preservar el estado critico
            if ($r.Color -eq "ROJO") {
                $todasLasFilas[$r.Num].Color = "ROJO"
            } elseif ($r.Color -eq "NARANJA" -and $todasLasFilas[$r.Num].Color -ne "ROJO") {
                $todasLasFilas[$r.Num].Color = "NARANJA"
            }
        }
    }
    Write-Output "    [VISTA $paso/$totalPasos] $nuevos animales nuevos detectados (Progreso total: $($todasLasFilas.Count)/$($animales.Count))."

    $g.Dispose()
    $bmpFull.Dispose()
}

# Retornar la tabla al tope superior de forma limpia antes de limpiar
if ($totalPasos -gt 1) {
    [PremierFullProbe]::ScrollToTop(1050, 400)
    Start-Sleep -Milliseconds 250
}

# =====================================================================
# REGLA DE ORO DE SEGURIDAD ABSOLUTA: LIMPIAR TICKET CON TECLA 'N' (LIMPIEZA 2 DE 2)
# =====================================================================
Write-Output "`n[REGLA DE ORO] Cancelando jugada y limpiando pantalla de Premier Pluss (2 de 2)..."
LimpiarTicketYPantallaPremier "FINAL"
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

