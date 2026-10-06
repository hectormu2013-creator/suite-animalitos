Add-Type -Path "scripts/sondeo_completo.ps1" -ErrorAction SilentlyContinue
# Or compile find logic directly:
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class FindWin {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static IntPtr FindPremier(out RECT r) {
        IntPtr found = IntPtr.Zero;
        RECT foundRect = new RECT();

        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                    if (IsWindowVisible(hWnd)) {
                        RECT rc;
                        GetWindowRect(hWnd, out rc);
                        int w = rc.Right - rc.Left;
                        int h = rc.Bottom - rc.Top;
                        if (w > 500 && h > 400) {
                            found = hWnd;
                            foundRect = rc;
                            return false;
                        }
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);

        r = foundRect;
        return found;
    }
}
"@

$rc = New-Object FindWin+RECT
$hwnd = [FindWin]::FindPremier([ref]$rc)
Write-Host "HWND: $hwnd"
Write-Host "Rect: Left=$($rc.Left), Top=$($rc.Top), Right=$($rc.Right), Bottom=$($rc.Bottom) ($($rc.Right - $rc.Left) x $($rc.Bottom - $rc.Top))"
