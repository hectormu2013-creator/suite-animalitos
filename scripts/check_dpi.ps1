Add-Type @"
using System;
using System.Runtime.InteropServices;

public class DpiTest {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("gdi32.dll")]
    public static extern int GetDeviceCaps(IntPtr hdc, int nIndex);

    public static void Check() {
        SetProcessDPIAware();
        IntPtr hdc = GetDC(IntPtr.Zero);
        int logPixelsX = GetDeviceCaps(hdc, 88); // LOGPIXELSX
        int logPixelsY = GetDeviceCaps(hdc, 90); // LOGPIXELSY
        Console.WriteLine(string.Format("DPI X: {0}, DPI Y: {1} (Escala: {2}%)", 
            logPixelsX, logPixelsY, (logPixelsX * 100) / 96));
    }
}
"@
[DpiTest]::Check()
