Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinStaHelper {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    public static void Attach() {
        IntPtr hw = OpenWindowStation("WinSta0", false, 0x10000000);
        SetProcessWindowStation(hw);
        IntPtr hd = OpenDesktop("Default", 0, false, 0x10000000);
        SetThreadDesktop(hd);
    }
}
"@

[WinStaHelper]::Attach()

$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$rect = $screen.Bounds
$bmp = New-Object System.Drawing.Bitmap $rect.Width, $rect.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($rect.Location, [System.Drawing.Point]::Empty, $rect.Size)

$outPath = Join-Path $PSScriptRoot "current_desktop.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved to $outPath ($($rect.Width)x$($rect.Height))"
