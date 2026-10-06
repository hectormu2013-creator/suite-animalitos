Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class CheckPremierWins {
    [DllImport("user32.dll")]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);
    [DllImport("user32.dll")]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static void CheckPid(int targetPid) {
        IntPtr hw = OpenWindowStation("WinSta0", false, 0x10000000);
        SetProcessWindowStation(hw);
        IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
        SetThreadDesktop(hd);

        int count = 0;
        EnumDesktopWindows(hd, (hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == targetPid) {
                count++;
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                StringBuilder cb = new StringBuilder(256);
                GetClassName(hWnd, cb, 256);
                RECT r;
                GetWindowRect(hWnd, out r);
                bool vis = IsWindowVisible(hWnd);
                Console.WriteLine(string.Format("hWnd: {0} Class: '{1}' Vis: {2} Size: {3}x{4} Title: '{5}'",
                    hWnd, cb.ToString(), vis, (r.Right-r.Left), (r.Bottom-r.Top), sb.ToString()));
            }
            return true;
        }, IntPtr.Zero);
        Console.WriteLine("Total windows for PID " + targetPid + ": " + count);
    }
}
"@

$p = Get-Process PremierPlussPC20 -ErrorAction SilentlyContinue
if ($p) {
    [CheckPremierWins]::CheckPid($p.Id)
} else {
    Write-Output "No Premier process found."
}
