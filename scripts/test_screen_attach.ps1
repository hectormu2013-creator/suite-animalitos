Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinStaFullAttach {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public static bool EnsureDesktop() {
        try {
            IntPtr hw = OpenWindowStation("WinSta0", false, 0x10000000);
            if (hw != IntPtr.Zero) SetProcessWindowStation(hw);
            IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
            if (hd != IntPtr.Zero) return SetThreadDesktop(hd);
        } catch {}
        return false;
    }
}
"@

$att = [WinStaFullAttach]::EnsureDesktop()
Write-Output "EnsureDesktop: $att"

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
try {
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    Write-Output "CopyFromScreen SUCCESS: $($bounds.Width)x$($bounds.Height)"
} catch {
    Write-Output "CopyFromScreen FAILED: $_"
} finally {
    $g.Dispose()
    $bmp.Dispose()
}
