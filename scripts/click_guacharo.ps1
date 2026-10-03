Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinHelper {
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

    public static IntPtr FindPremierWindow(uint pid) {
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

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }
}
"@

$proc = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue | Select-Object -First 1
if (!$proc) {
    Write-Output "ERROR: PremierPlussPC20 no esta abierto."
    exit 1
}

$hwnd = [WinHelper]::FindPremierWindow([uint32]$proc.Id)
Write-Output "Premier HWND: $hwnd"

if ($hwnd -ne [IntPtr]::Zero) {
    [WinHelper]::ShowWindow($hwnd, 3) # SW_MAXIMIZE
    [WinHelper]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 500

    Write-Output "Haciendo clic en Guacharo Activo (X=120, Y=347)..."
    [WinHelper]::Click(120, 347)
    Start-Sleep -Milliseconds 800
    Write-Output "[OK] Clic enviado a Guacharo Activo."
}
