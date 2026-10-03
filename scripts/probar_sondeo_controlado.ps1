Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class PremierPilot {
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
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;

    public static IntPtr FindPremier() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                    StringBuilder title = new StringBuilder(256);
                    GetWindowText(hWnd, title, 256);
                    string t = title.ToString();
                    if (t.Contains("Premier Pluss")) {
                        found = hWnd;
                        return false;
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }
}
"@

Write-Output "=========================================================="
Write-Output "  PRUEBA CONTROLADA - MARCAJE UNICO DE SORTEO Y JUGADA"
Write-Output "=========================================================="

$hwnd = [PremierPilot]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "[ERROR] No se detecto Premier Pluss 2.0 abierto."
    exit 1
}

Write-Output "[1/6] Restaurando y maximizando Premier Pluss..."
[PremierPilot]::ShowWindow($hwnd, 9) # SW_RESTORE
[PremierPilot]::ShowWindow($hwnd, 3) # SW_MAXIMIZE
[PremierPilot]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 600

# Cerrar cualquier dialogo previo si habia quedado abierto
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 200

# 1. Asegurar seleccion de Guacharo Activo
Write-Output "[2/6] Seleccionando Guacharo Activo..."
[PremierPilot]::Click(120, 270)
Start-Sleep -Milliseconds 400

# 2. Marcar proximo sorteo: 1 SOLO CLIC en la primera casilla (X=328, Y=63)
Write-Output "[3/6] Marcando sorteo (1 solo clic en casilla X=328, Y=63)..."
[PremierPilot]::Click(328, 63)
Start-Sleep -Milliseconds 300

# 3. Marcar 5 animales de prueba (Fila 0: 00 Ballena, 0 Delfin, 1 Carnero, 2 Toro, 3 Ciempié)
Write-Output "[4/6] Marcando animales de prueba..."
# Col 0 (00): X=352, Y=184
[PremierPilot]::Click(352, 184)
Start-Sleep -Milliseconds 70
# Col 1 (0): X=418, Y=184
[PremierPilot]::Click(418, 184)
Start-Sleep -Milliseconds 70
# Col 2 (1): X=483, Y=184
[PremierPilot]::Click(483, 184)
Start-Sleep -Milliseconds 70
# Col 3 (2): X=549, Y=184
[PremierPilot]::Click(549, 184)
Start-Sleep -Milliseconds 70
# Col 4 (3): X=614, Y=184
[PremierPilot]::Click(614, 184)
Start-Sleep -Milliseconds 150

# 4. Asignar monto 100 Bs y presionar [+]
Write-Output "[5/6] Cargando monto 100 Bs y agregando a la tabla..."
[PremierPilot]::Click(865, 62)
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("100")
Start-Sleep -Milliseconds 100
# Clic en boton [+] (Cursor X=1065, Y=62)
[PremierPilot]::Click(1065, 62)

Write-Output "--> [VERIFICACION VISUAL] Mira tu pantalla: se agregaron las jugadas con el sorteo marcado a la tabla."
Write-Output "--> Esperando 5 segundos antes de ejecutar la limpieza con tecla 'N'..."
Start-Sleep -Seconds 5

# 5. REGLA DE ORO: Limpiar pantalla con 'N'
Write-Output "[6/6] [REGLA DE ORO] Ejecutando tecla 'N' para limpiar pantalla a 0 jugadas..."
[System.Windows.Forms.SendKeys]::SendWait("n")
Start-Sleep -Milliseconds 800

# Capturar pantalla final de verificacion
try {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $outFile = Join-Path $PSScriptRoot "..\premier_test_limpieza.png"
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "[EXITO] Captura final guardada en premier_test_limpieza.png"
} catch {}

Write-Output "`n=========================================================="
Write-Output "  PRUEBA CONTROLADA COMPLETADA CON EXITO (TICKET LIMPIO)"
Write-Output "=========================================================="
