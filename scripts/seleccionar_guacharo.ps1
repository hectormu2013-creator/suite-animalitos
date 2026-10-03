Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class WinMouse {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }
}
"@

$proc = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue
if (!$proc) {
    Write-Output "ERROR: PremierPlussPC20 no esta en ejecucion."
    exit 1
}

# Restaurar y enfocar
Add-Type -ReferencedAssemblies 'System.Drawing', 'System.Windows.Forms' @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WinFind {
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

    public static IntPtr GetMain(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, l) => {
            uint p;
            GetWindowThreadProcessId(h, out p);
            if (p == pid) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(h, sb, 256);
                if (sb.ToString().Contains("Premier Pluss")) {
                    found = h;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

$hwnd = [WinFind]::GetMain([uint32]$proc.Id)
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "No se encontro ventana principal."
    exit 1
}

[WinFind]::ShowWindow($hwnd, 3) # SW_MAXIMIZE
[WinFind]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 600

# Hacer clic en Guacharo Activo (X=120, Y=347)
Write-Output "Haciendo clic en Guacharo Activo (X=120, Y=347)..."
[WinMouse]::Click(120, 347)
Start-Sleep -Milliseconds 1200

# Capturar pantalla
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$outFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Output "[EXITO] Pantalla de Guacharo Activo capturada en: premier_guacharo_activo.png"
