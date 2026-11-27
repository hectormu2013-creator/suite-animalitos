# ==============================================================================
# AUTO-APERTURA Y AUTO-LOGIN DE PREMIER PLUSS 2.0 (MODO VIAJE 24/7 AUTÓNOMO)
# Abre PremierPlussPC20.exe si está cerrado, detecta la ventana de Login,
# inicia sesión automáticamente y deja la taquilla en la pestaña Animalitos (F2).
# ==============================================================================

param(
    [string]$ExecutablePath = "",
    [string]$Usuario = "",
    [string]$Clave = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class PremierAutoStarter {
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
    public static extern IntPtr GetForegroundWindow();

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

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, StringBuilder lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    public const uint WM_SETTEXT = 0x000C;
    public const uint WM_GETTEXT = 0x000D;
    public const uint WM_GETTEXTLENGTH = 0x000E;
    public const uint BM_CLICK = 0x00F5;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(45);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(55);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static bool ForceForeground(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return false;
        uint fgPid = 0, targetPid = 0;
        IntPtr fg = GetForegroundWindow();
        uint fgThread = GetWindowThreadProcessId(fg, out fgPid);
        uint targetThread = GetWindowThreadProcessId(hWnd, out targetPid);
        uint curThread = GetCurrentThreadId();
        try {
            AttachThreadInput(curThread, fgThread, true);
            AttachThreadInput(curThread, targetThread, true);
            keybd_event(0x12, 0, 0, UIntPtr.Zero);
            keybd_event(0x12, 0, 2, UIntPtr.Zero);
            ShowWindow(hWnd, 9);
            SetForegroundWindow(hWnd);
        } catch {}
        finally {
            try { AttachThreadInput(curThread, targetThread, false); } catch {}
            try { AttachThreadInput(curThread, fgThread, false); } catch {}
        }
        System.Threading.Thread.Sleep(100);
        return true;
    }

    public static string GetControlText(IntPtr hWnd) {
        int len = (int)SendMessage(hWnd, WM_GETTEXTLENGTH, IntPtr.Zero, IntPtr.Zero);
        if (len <= 0) return "";
        StringBuilder sb = new StringBuilder(len + 2);
        SendMessage(hWnd, WM_GETTEXT, (IntPtr)(len + 1), sb);
        return sb.ToString();
    }

    // Devuelve todas las ventanas visibles o minimizadas de PremierPlussPC20 ordenadas por area descendente
    public static List<IntPtr> GetPremierWindows() {
        List<IntPtr> list = new List<IntPtr>();
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
                    if (IsIconic(hWnd) || (IsWindowVisible(hWnd) && w > 250 && h > 200)) {
                        list.Add(hWnd);
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@

[PremierAutoStarter]::SetProcessDPIAware() | Out-Null

# 1. Cargar configuración desde config.json si no se pasaron parámetros
$rootDir = Split-Path $PSScriptRoot -Parent
$cfgPath = Join-Path $rootDir "config.json"

if (-not $ExecutablePath) {
    $ExecutablePath = "C:\Program Files (x86)\Premier Pluss 2.0\PremierPlussPC20.exe"
}

if (Test-Path $cfgPath) {
    try {
        $cfg = Get-Content $cfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
        $localId = if ($cfg.general.maquinaLocalId) { $cfg.general.maquinaLocalId } else { "maquina_2" }
        $maq = $cfg.general.maquinas | Where-Object { $_.id -eq $localId } | Select-Object -First 1
        if (-not $maq) { $maq = $cfg.general.maquinas | Select-Object -First 1 }

        if ($maq) {
            if ($maq.executablePath -and (Test-Path $maq.executablePath)) { $ExecutablePath = $maq.executablePath }
            if (-not $Usuario -and $maq.usuarioPremier) { $Usuario = $maq.usuarioPremier }
            if (-not $Clave -and $maq.clavePremier) { $Clave = $maq.clavePremier }
        }
        if (-not $Usuario -and $cfg.general.premierPluss.user) { $Usuario = $cfg.general.premierPluss.user }
        if (-not $Clave -and $cfg.general.premierPluss.password) { $Clave = $cfg.general.premierPluss.password }
    } catch {}
}

if (-not $Usuario) { $Usuario = "TCOP101" }
if (-not $Clave) { $Clave = "123" }

function Inspect-WindowState {
    $wins = [PremierAutoStarter]::GetPremierWindows()
    $mainHwnd = [IntPtr]::Zero
    $loginHwnd = [IntPtr]::Zero

    foreach ($w in $wins) {
        $rect = New-Object PremierAutoStarter+RECT
        [PremierAutoStarter]::GetWindowRect($w, [ref]$rect) | Out-Null
        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top
        $isMin = [PremierAutoStarter]::IsIconic($w)

        if ($isMin) {
            [PremierAutoStarter]::ShowWindow($w, 9) | Out-Null
            Start-Sleep -Milliseconds 300
            [PremierAutoStarter]::GetWindowRect($w, [ref]$rect) | Out-Null
            $width = $rect.Right - $rect.Left
            $height = $rect.Bottom - $rect.Top
        }

        # La ventana principal de la taquilla mide >= 800 px de ancho; la ventana de Login mide ~480-680 px
        if ($width -ge 800 -and $height -ge 520) {
            $mainHwnd = $w
        } elseif ($width -ge 350 -and $width -lt 800 -and $height -ge 350) {
            $loginHwnd = $w
        }
    }

    return [PSCustomObject]@{
        MainHwnd = $mainHwnd
        LoginHwnd = $loginHwnd
    }
}

$state = Inspect-WindowState

# Si ya está abierta la ventana principal de la taquilla, maximizar, pulsar F2 y salir con éxito
if ($state.MainHwnd -ne [IntPtr]::Zero) {
    Write-Output "[AUTO-STARTER] Premier Pluss 2.0 ya está abierto y con sesión iniciada."
    [PremierAutoStarter]::ShowWindow($state.MainHwnd, 3) | Out-Null
    [PremierAutoStarter]::ForceForeground($state.MainHwnd) | Out-Null
    Start-Sleep -Milliseconds 300
    try { [System.Windows.Forms.SendKeys]::SendWait("{F2}") } catch {}
    exit 0
}

# Si no hay ni ventana principal ni ventana de Login, lanzar el ejecutable
if ($state.LoginHwnd -eq [IntPtr]::Zero) {
    if (-not (Test-Path $ExecutablePath)) {
        Write-Output "[AUTO-STARTER ERROR] No existe el ejecutable en: $ExecutablePath"
        exit 1
    }

    Write-Output "[AUTO-STARTER] Iniciando Premier Pluss 2.0 desde: $ExecutablePath..."
    Start-Process -FilePath $ExecutablePath -WorkingDirectory (Split-Path $ExecutablePath)

    # Esperar hasta 25 segundos a que pase el Splash y aparezca Login o Main
    for ($i = 0; $i -lt 25; $i++) {
        Start-Sleep -Seconds 1
        $state = Inspect-WindowState
        if ($state.MainHwnd -ne [IntPtr]::Zero -or $state.LoginHwnd -ne [IntPtr]::Zero) {
            break
        }
    }
}

if ($state.MainHwnd -ne [IntPtr]::Zero) {
    Write-Output "[AUTO-STARTER] Ventana principal de Premier Pluss detectada directamente."
    [PremierAutoStarter]::ShowWindow($state.MainHwnd, 3) | Out-Null
    [PremierAutoStarter]::ForceForeground($state.MainHwnd) | Out-Null
    exit 0
}

if ($state.LoginHwnd -ne [IntPtr]::Zero) {
    Write-Output "[AUTO-STARTER] Ventana de Login de Premier Pluss detectada. Esperando conexión SignalR (4s)..."
    Start-Sleep -Seconds 4

    $loginHwnd = $state.LoginHwnd
    [PremierAutoStarter]::ForceForeground($loginHwnd) | Out-Null
    Start-Sleep -Milliseconds 400

    $rect = New-Object PremierAutoStarter+RECT
    [PremierAutoStarter]::GetWindowRect($loginHwnd, [ref]$rect) | Out-Null

    # Buscar controles hijos EDIT (Txt_UserName en Y~254, Txt_Password en Y~333) y BUTTON (Btn_DoLogin en X~261, Y~398)
    $edits = New-Object System.Collections.ArrayList
    $loginBtn = [IntPtr]::Zero

    $enumCallback = [PremierAutoStarter+EnumChildProc]{
        param($childHwnd, $lParam)
        $cls = New-Object System.Text.StringBuilder 256
        [PremierAutoStarter]::GetClassName($childHwnd, $cls, 256) | Out-Null
        $clsName = $cls.ToString()

        $cRect = New-Object PremierAutoStarter+RECT
        [PremierAutoStarter]::GetWindowRect($childHwnd, [ref]$cRect) | Out-Null
        $relX = $cRect.Left - $rect.Left
        $relY = $cRect.Top - $rect.Top

        if ($clsName -match "EDIT") {
            [void]$edits.Add([PSCustomObject]@{ Hwnd = $childHwnd; RelX = $relX; RelY = $relY })
        } elseif ($clsName -match "BUTTON" -and $relX -ge 220 -and $relX -le 320 -and $relY -ge 370 -and $relY -le 450) {
            $script:loginBtn = $childHwnd
        }
        return $true
    }
    [PremierAutoStarter]::EnumChildWindows($loginHwnd, $enumCallback, [IntPtr]::Zero) | Out-Null

    # Ordenar cajas de texto por posición vertical (1ra = Txt_UserName, 2da = Txt_Password)
    $sortedEdits = @($edits | Sort-Object RelY)
    if ($sortedEdits.Count -ge 2) {
        $userTxt = [PremierAutoStarter]::GetControlText($sortedEdits[0].Hwnd)
        $passTxt = [PremierAutoStarter]::GetControlText($sortedEdits[1].Hwnd)

        if (-not $userTxt) {
            Write-Output "[AUTO-STARTER] Rellenando usuario ($Usuario)..."
            [PremierAutoStarter]::SendMessage($sortedEdits[0].Hwnd, [PremierAutoStarter]::WM_SETTEXT, [IntPtr]::Zero, $Usuario) | Out-Null
            [PremierAutoStarter]::Click($rect.Left + 257, $rect.Top + 276)
            Start-Sleep -Milliseconds 150
            try { [System.Windows.Forms.SendKeys]::SendWait("^a{BACKSPACE}$Usuario") } catch {}
        }
        if (-not $passTxt) {
            Write-Output "[AUTO-STARTER] Rellenando clave..."
            [PremierAutoStarter]::SendMessage($sortedEdits[1].Hwnd, [PremierAutoStarter]::WM_SETTEXT, [IntPtr]::Zero, $Clave) | Out-Null
            [PremierAutoStarter]::Click($rect.Left + 257, $rect.Top + 355)
            Start-Sleep -Milliseconds 150
            try { [System.Windows.Forms.SendKeys]::SendWait("^a{BACKSPACE}$Clave") } catch {}
        }
    }

    # Disparar inicio de sesión: clic en Btn_DoLogin (X=261..376, Y=398..440 -> centro +318, +419) + tecla ENTER
    Write-Output "[AUTO-STARTER] Pulsando botón Iniciar Sesión en Premier Pluss..."
    [PremierAutoStarter]::ForceForeground($loginHwnd) | Out-Null
    [PremierAutoStarter]::Click($rect.Left + 318, $rect.Top + 419)
    Start-Sleep -Milliseconds 250
    try { [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") } catch {}

    # Esperar hasta 20 segundos a que cargue la ventana principal de la taquilla
    for ($w = 0; $w -lt 20; $w++) {
        Start-Sleep -Seconds 1
        $state = Inspect-WindowState
        if ($state.MainHwnd -ne [IntPtr]::Zero) {
            Write-Output "[AUTO-STARTER] ¡Sesión iniciada con éxito en Premier Pluss 2.0!"
            Start-Sleep -Seconds 2
            [PremierAutoStarter]::ShowWindow($state.MainHwnd, 3) | Out-Null
            [PremierAutoStarter]::ForceForeground($state.MainHwnd) | Out-Null
            Start-Sleep -Milliseconds 400
            try { [System.Windows.Forms.SendKeys]::SendWait("{F2}") } catch {}
            exit 0
        }
    }
}

Write-Output "[AUTO-STARTER AVISO] No se pudo confirmar la ventana principal de Premier Pluss tras el intento de auto-inicio."
exit 1
