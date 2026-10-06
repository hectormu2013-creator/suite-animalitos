Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinStaErr {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    public static void Check() {
        IntPtr hw = OpenWindowStation("WinSta0", false, 0x02000000);
        int errW = Marshal.GetLastWin32Error();
        IntPtr hd = OpenDesktop("Default", 0, false, 0x02000000);
        int errD = Marshal.GetLastWin32Error();
        Console.WriteLine(string.Format("hw: {0} errW: {1} | hd: {2} errD: {3}", hw, errW, hd, errD));
    }
}
"@
[WinStaErr]::Check()
