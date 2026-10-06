Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class TestNewFind {
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
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static IntPtr FindPremier() {
        // Asegurar conexion a la estacion interactiva y escritorio Default
        try {
            IntPtr hw = OpenWindowStation("WinSta0", false, 0x10000000);
            if (hw != IntPtr.Zero) SetProcessWindowStation(hw);
            IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
            if (hd != IntPtr.Zero) SetThreadDesktop(hd);
        } catch {}

        IntPtr found = IntPtr.Zero;

        // 1. Verificacion rapida por MainWindowHandle
        try {
            Process[] procs = Process.GetProcessesByName("PremierPlussPC20");
            foreach (Process p in procs) {
                if (p.MainWindowHandle != IntPtr.Zero) {
                    return p.MainWindowHandle;
                }
            }
        } catch {}

        // 2. EnumDesktopWindows en Default
        try {
            IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
            if (hd != IntPtr.Zero) {
                EnumDesktopWindows(hd, (hWnd, lParam) => {
                    uint pid = 0;
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
                                return false; // Parar busqueda
                            }
                        }
                    } catch {}
                    return true;
                }, IntPtr.Zero);
            }
        } catch {}

        // 3. Fallback EnumWindows
        if (found == IntPtr.Zero) {
            EnumWindows((hWnd, lParam) => {
                uint pid = 0;
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
                    }
                } catch {}
                return true;
            }, IntPtr.Zero);
        }

        return found;
    }
}
"@

$h = [TestNewFind]::FindPremier()
Write-Output "RESULT FOUND HWND: $h"
