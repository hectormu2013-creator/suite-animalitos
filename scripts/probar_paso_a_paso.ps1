param(
    [int]$Paso = 1,
    [string]$Loteria = "GUACHARO ACTIVO"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class StepTester {
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

    public static bool DismissAllExceptions() {
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

        if (found == IntPtr.Zero) {
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
        }

        return found;
    }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }
}
"@

$hwnd = [StepTester]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "[ERROR] Premier Pluss 2.0 no esta abierto en el escritorio."
    Write-Output "Por favor abre la taquilla de Premier Pluss y vuelve a intentarlo."
    exit 1
}

Write-Output "=========================================================="
Write-Output "  PREMIER PLUSS 2.0 DETECTADO (HWND: $hwnd)"
Write-Output "=========================================================="

switch ($Paso) {
    1 {
        Write-Output "`n[PASO 1] Enfocando Premier Pluss y descartando errores previos..."
        [StepTester]::ShowWindow($hwnd, 9)
        [StepTester]::ShowWindow($hwnd, 3)
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 400

        $descartado = [StepTester]::DismissAllExceptions()
        if ($descartado) {
            Write-Output " -> [OK] Se detecto el cuadro de error y se pulso 'Continuar' automaticamente."
        } else {
            # Intentar tambien con Enter en caso de que sea un cuadro estandar
            try { [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") } catch {}
            Write-Output " -> [OK] Ventana enfocada."
        }
        Start-Sleep -Milliseconds 300
        Write-Output " -> Asegurando pestana ANIMALITOS (F2)..."
        try { [System.Windows.Forms.SendKeys]::SendWait("{F2}") } catch {}
        Write-Output " -> [OK] Premier Pluss en pestana Animalitos y listo."
    }

    2 {
        Write-Output "`n[PASO 2] Seleccionando Loteria ($Loteria) y Marcando Sorteo..."
        [StepTester]::ShowWindow($hwnd, 9)
        [StepTester]::ShowWindow($hwnd, 3)
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Write-Output " -> Asegurando pestana ANIMALITOS con tecla F2..."
        try {
            [System.Windows.Forms.SendKeys]::SendWait("{F2}")
            Start-Sleep -Milliseconds 300
        } catch {}

        # Coordenadas Y exactas calibradas por OCR (1536x864, 125% DPI):
        # LA GRANJITA:           204
        # GUACHARITO MILLONARIO: 314
        # GUACHARO ACTIVO:       342
        # LOTTO ACTIVO:          369
        # SELVA PLUS:            452
        $lotY = switch -Wildcard ($Loteria.ToUpper().Trim()) {
            "*MILLONARIO*"    { 314 }
            "*GRANJITA*"      { 204 }
            "*LOTTO ACTIVO*"  { 369 }
            "*GUACHARO*"      { 342 }
            "*SELVA PLUS*"    { 452 }
            default           { 342 }
        }

        Write-Output " -> Haciendo clic en loteria ($Loteria) en X=120, Y=$lotY..."
        [StepTester]::Click(120, $lotY)
        Start-Sleep -Milliseconds 600

        # La casilla 1 (Q) del sorteo esta SIEMPRE en X=328, Y=63 para todas las loterias
        Write-Output " -> Marcando sorteo de $Loteria en casilla 1 (X=328, Y=63)..."
        [StepTester]::Click(328, 63)
        Start-Sleep -Milliseconds 300

        Write-Output "`n[VERIFICACION] Mira la pantalla de Premier Pluss: ¿Esta seleccionada la loteria ($Loteria) y marcada la casilla del sorteo?"
    }

    3 {
        Write-Output "`n[PASO 3] Probando Inyeccion Rapida de 3 Animales de Prueba (Monto 3000 Bs)..."
        [StepTester]::ShowWindow($hwnd, 9)
        [StepTester]::ShowWindow($hwnd, 3)
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 300

        # Precargar Monto F6
        Write-Output " -> Precargando monto 3000 Bs en F6..."
        [System.Windows.Forms.SendKeys]::SendWait("{F6}")
        Start-Sleep -Milliseconds 150
        [System.Windows.Forms.SendKeys]::SendWait("3000")
        Start-Sleep -Milliseconds 150
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Milliseconds 250

        # Ingresar 3 animales: 00, 0, 1
        $testAnimals = @("00", "0", "1")
        Write-Output " -> Ingresando 3 animales a velocidad ultrarrapida..."
        foreach ($a in $testAnimals) {
            Write-Host "    -> Ingresando animal '$a'..."
            [System.Windows.Forms.SendKeys]::SendWait("{F5}")
            Start-Sleep -Milliseconds 35
            [System.Windows.Forms.SendKeys]::SendWait("$a")
            Start-Sleep -Milliseconds 40
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 50
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 120
        }

        Write-Output "`n[VERIFICACION] ¿Aparecieron los 3 animales en la lista 'Jugadas del ticket' sin ningun error?"
    }

    4 {
        Write-Output "`n[PASO 4] Cancelando jugadas y limpiando pantalla de Premier con Tecla 'N'..."
        [StepTester]::ShowWindow($hwnd, 9)
        [StepTester]::ShowWindow($hwnd, 3)
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 200

        try {
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait("n")
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 200
        } catch {}

        Write-Output " -> [OK] Pantalla restablecida a 0 jugadas."
        Write-Output "`n[VERIFICACION] ¿Quedo la pantalla limpia en 0 jugadas?"
    }
}
