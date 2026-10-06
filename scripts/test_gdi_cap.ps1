Add-Type -ReferencedAssemblies 'System.Drawing' @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;

public class GdiCapture {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);
    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);
    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, int dwRop);
    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);
    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    public const int SRCCOPY = 0x00CC0020;

    public static bool Capture(int w, int h, string outPath) {
        IntPtr hdcSrc = GetDC(IntPtr.Zero);
        if (hdcSrc == IntPtr.Zero) {
            Console.WriteLine("GetDC failed: " + Marshal.GetLastWin32Error());
            return false;
        }
        IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, w, h);
        IntPtr hOld = SelectObject(hdcDest, hBitmap);
        bool blt = BitBlt(hdcDest, 0, 0, w, h, hdcSrc, 0, 0, SRCCOPY);
        SelectObject(hdcDest, hOld);
        DeleteDC(hdcDest);
        ReleaseDC(IntPtr.Zero, hdcSrc);

        if (blt) {
            using (Bitmap bmp = Bitmap.FromHbitmap(hBitmap)) {
                bmp.Save(outPath);
            }
            DeleteObject(hBitmap);
            return true;
        }
        DeleteObject(hBitmap);
        return false;
    }
}
"@

$res = [GdiCapture]::Capture(1536, 864, "$PSScriptRoot/gdi_test.png")
Write-Output "GdiCapture result: $res"
