Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class ThreadWinTest {
    public delegate bool EnumThreadDelegate(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumThreadWindows(int dwThreadId, EnumThreadDelegate lpfn, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static void FindWindowsForPid(int pid) {
        try {
            Process p = Process.GetProcessById(pid);
            Console.WriteLine("Process: " + p.ProcessName + " Threads count: " + p.Threads.Count);
            foreach (ProcessThread t in p.Threads) {
                EnumThreadWindows(t.Id, (hWnd, lParam) => {
                    StringBuilder title = new StringBuilder(256);
                    GetWindowText(hWnd, title, 256);
                    StringBuilder cls = new StringBuilder(256);
                    GetClassName(hWnd, cls, 256);
                    RECT r;
                    GetWindowRect(hWnd, out r);
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    bool vis = IsWindowVisible(hWnd);
                    Console.WriteLine("  HWND=" + hWnd + " Thread=" + t.Id + " Vis=" + vis + " Size=" + w + "x" + h + " Class='" + cls.ToString() + "' Title='" + title.ToString() + "'");
                    return true;
                }, IntPtr.Zero);
            }
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
"@

$p = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) {
    [ThreadWinTest]::FindWindowsForPid($p.Id)
} else {
    Write-Output "No PremierPlussPC20 found."
}
