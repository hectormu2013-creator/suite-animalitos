Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class TestEnumDesk {
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
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static void Run() {
        IntPtr hw = OpenWindowStation("WinSta0", false, 0x10000000);
        bool sP = SetProcessWindowStation(hw);
        IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
        bool sT = SetThreadDesktop(hd);
        Console.WriteLine(string.Format("sP: {0}, sT: {1}", sP, sT));

        int count = 0;
        EnumDesktopWindows(hd, (hWnd, lParam) => {
            count++;
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (!string.IsNullOrEmpty(title)) {
                Console.WriteLine(string.Format("hWnd: {0} PID: {1} Title: '{2}'", hWnd, pid, title));
            }
            return true;
        }, IntPtr.Zero);
        Console.WriteLine("Total windows: " + count);
    }
}
"@
[TestEnumDesk]::Run()
