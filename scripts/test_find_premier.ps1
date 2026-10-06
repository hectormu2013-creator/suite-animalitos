Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class TestPremierDetector {
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static void Test() {
        Console.WriteLine("--- Testing Process.GetProcessesByName ---");
        Process[] procs = Process.GetProcessesByName("PremierPlussPC20");
        Console.WriteLine("Found procs count: " + procs.Length);
        foreach (Process p in procs) {
            Console.WriteLine("PID=" + p.Id + " MainWindowHandle=" + p.MainWindowHandle + " MainWindowTitle='" + p.MainWindowTitle + "'");
        }

        Console.WriteLine("--- Testing EnumWindows for PID ---");
        EnumWindows((hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            foreach (Process p in procs) {
                if (pid == p.Id) {
                    StringBuilder t = new StringBuilder(256);
                    GetWindowText(hWnd, t, 256);
                    StringBuilder c = new StringBuilder(256);
                    GetClassName(hWnd, c, 256);
                    RECT r;
                    GetWindowRect(hWnd, out r);
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    bool vis = IsWindowVisible(hWnd);
                    bool min = IsIconic(hWnd);
                    Console.WriteLine("HWND=" + hWnd + " Class='" + c.ToString() + "' Vis=" + vis + " Min=" + min + " Size=" + w + "x" + h + " Title='" + t.ToString() + "'");
                }
            }
            return true;
        }, IntPtr.Zero);
    }
}
"@

[TestPremierDetector]::Test()
