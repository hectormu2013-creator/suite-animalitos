Add-Type -ReferencedAssemblies 'System.Drawing' @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;

public class TestPrintWin {
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static bool CaptureWindow(IntPtr hWnd, string outPath) {
        RECT r;
        GetWindowRect(hWnd, out r);
        int w = r.Right - r.Left;
        int h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0) return false;

        using (Bitmap bmp = new Bitmap(w, h)) {
            using (Graphics g = Graphics.FromImage(bmp)) {
                IntPtr hdc = g.GetHdc();
                try {
                    bool res = PrintWindow(hWnd, hdc, 2); // 2 = PW_RENDERFULLCONTENT
                    if (!res) res = PrintWindow(hWnd, hdc, 0);
                    return res;
                } finally {
                    g.ReleaseHdc(hdc);
                }
            }
        }
    }
}
"@

$hWnd = [IntPtr]5705092
$ok = [TestPrintWin]::CaptureWindow($hWnd, "$PSScriptRoot/test_print_win.png")
Write-Output "PrintWindow result: $ok"
