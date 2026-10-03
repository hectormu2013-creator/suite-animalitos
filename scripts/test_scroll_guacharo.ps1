Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class GuacharoScroller {
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

    public const uint MOUSEEVENTF_WHEEL = 0x0800;

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
                    if (title.ToString().Contains("Premier Pluss")) {
                        found = hWnd;
                        return false;
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void ScrollDown(int x, int y, int notches) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(100);
        // Cada muesca de rueda es 120 unidades. Negativo = hacia abajo
        for (int i = 0; i < notches; i++) {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)(-120), 0);
            System.Threading.Thread.Sleep(50);
        }
    }
}
"@

$hwnd = [GuacharoScroller]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "ERROR: Premier Pluss no encontrado."
    exit 1
}

Write-Output "Enfocando ventana..."
[GuacharoScroller]::ShowWindow($hwnd, 3) # SW_MAXIMIZE
[GuacharoScroller]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 600

# Mover el cursor al panel de animalitos (X=480, Y=350 en cursor) y scrollear 6 muescas hacia abajo
Write-Output "Enviando scroll hacia abajo en la cuadricula de animalitos..."
[GuacharoScroller]::ScrollDown(480, 350, 8)
Start-Sleep -Milliseconds 1200

# Capturar pantalla
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$outFile = Join-Path $PSScriptRoot "..\premier_guacharo_scrolled.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Output "[EXITO] Pantalla scrolleada guardada en premier_guacharo_scrolled.png"
