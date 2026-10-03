Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class GuacharoInspector {
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

    public static IntPtr FindPremierMainWindow() {
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
                        return false; // Detener busqueda
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }
}
"@

$hwnd = [GuacharoInspector]::FindPremierMainWindow()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "ERROR: No se encontro el proceso PremierPlussPC20."
    Write-Output "Por favor asegurate de que Premier Pluss este abierto."
    exit 1
}

Write-Output "Enfocando ventana real de Premier Pluss (HWND: $hwnd)..."
[GuacharoInspector]::ShowWindow($hwnd, 9) # SW_RESTORE
[GuacharoInspector]::ShowWindow($hwnd, 3) # SW_MAXIMIZE
[GuacharoInspector]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 800

# Guacharo Activo: X=120, Y=270 (calibrado a 125% DPI)
Write-Output "Haciendo clic en GUACHARO ACTIVO (X=120, Y=270)..."
[GuacharoInspector]::Click(120, 270)
Start-Sleep -Milliseconds 1500

# Capturar pantalla
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$outFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Output "[EXITO] Pantalla real de Guacharo Activo guardada en premier_guacharo_activo.png"
