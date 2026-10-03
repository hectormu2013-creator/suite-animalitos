Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WinControlFinder {
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
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static IntPtr FindMainWindow(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint p;
            GetWindowThreadProcessId(hWnd, out p);
            if (p == pid) {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(hWnd, title, 256);
                if (title.ToString().Contains("Premier Pluss")) {
                    found = hWnd;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void PrintChildren(IntPtr parent) {
        int count = 0;
        EnumChildWindows(parent, (h, l) => {
            StringBuilder title = new StringBuilder(256);
            GetWindowText(h, title, 256);
            StringBuilder cls = new StringBuilder(256);
            GetClassName(h, cls, 256);
            RECT r;
            GetWindowRect(h, out r);
            bool vis = IsWindowVisible(h);
            if (vis) {
                count++;
                Console.WriteLine(string.Format("[CHILD {0}] HWND:{1} | Cls:{2} | Dim:{3}x{4} at ({5},{6}) | Text:'{7}'", 
                    count, h, cls, r.Right - r.Left, r.Bottom - r.Top, r.Left, r.Top, title));
            }
            return true;
        }, IntPtr.Zero);
        Console.WriteLine("Total visible child controls: " + count);
    }
}
"@

$proc = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue
if (!$proc) {
    Write-Output "Proceso PremierPlussPC20 no encontrado."
    exit 1
}

$hWnd = [WinControlFinder]::FindMainWindow($proc.Id)
Write-Output "MainWindow HWND: $hWnd (PID: $($proc.Id))"
if ($hWnd -ne [IntPtr]::Zero) {
    [WinControlFinder]::PrintChildren($hWnd)
}
