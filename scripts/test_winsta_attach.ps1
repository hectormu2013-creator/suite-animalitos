Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinStaAttacher {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public const uint GENERIC_ALL = 0x10000000;
    public const uint MAXIMUM_ALLOWED = 0x02000000;

    public static int TestAttachAndCount() {
        IntPtr hwinsta = OpenWindowStation("WinSta0", false, MAXIMUM_ALLOWED);
        if (hwinsta != IntPtr.Zero) {
            SetProcessWindowStation(hwinsta);
            IntPtr hdesk = OpenDesktop("Default", 0, false, MAXIMUM_ALLOWED);
            if (hdesk != IntPtr.Zero) {
                SetThreadDesktop(hdesk);
            }
        }

        int count = 0;
        EnumWindows((hWnd, lParam) => {
            count++;
            return true;
        }, IntPtr.Zero);
        return count;
    }
}
"@

$cnt = [WinStaAttacher]::TestAttachAndCount()
Write-Output "COUNT AFTER ATTACH: $cnt"
