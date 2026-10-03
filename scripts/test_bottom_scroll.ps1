Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class BottomScroller {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
    public const uint MOUSEEVENTF_WHEEL    = 0x0800;

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

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(40);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(40);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void ScrollToBottom(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(60);
        for (int i = 0; i < 25; i++) {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -120, UIntPtr.Zero);
            System.Threading.Thread.Sleep(20);
        }
    }
}
"@

$hwnd = [BottomScroller]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "Premier Pluss no detectado."
    exit 1
}

[BottomScroller]::ShowWindow($hwnd, 3)
[BottomScroller]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 500

# Limpiar por si hay algo abierto
[System.Windows.Forms.SendKeys]::SendWait("n")
Start-Sleep -Milliseconds 400

# Seleccionar Guacharo Activo
[BottomScroller]::Click(120, 270)
Start-Sleep -Milliseconds 400

# Scrollear al fondo maximo
[BottomScroller]::ScrollToBottom(500, 400)
Start-Sleep -Milliseconds 800

# Capturar pantalla del fondo
$outFile = Join-Path $PSScriptRoot "..\premier_guacharo_fondo.png"
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Captura del fondo guardada en premier_guacharo_fondo.png"
