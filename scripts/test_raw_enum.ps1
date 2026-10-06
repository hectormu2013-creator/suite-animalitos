Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class RawEnum {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static int CountAll() {
        int count = 0;
        EnumWindows((hWnd, lParam) => {
            count++;
            return true;
        }, IntPtr.Zero);
        return count;
    }
}
"@

$c = [RawEnum]::CountAll()
Write-Output "RAW WINDOW COUNT: $c"
