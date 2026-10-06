Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# Find Premier Pluss Window
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class WinCapture {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static IntPtr FindPremier() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                    if (IsWindowVisible(hWnd)) {
                        RECT rc;
                        GetWindowRect(hWnd, out rc);
                        if ((rc.Right - rc.Left) > 500) {
                            found = hWnd;
                            return false;
                        }
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

$hwnd = [WinCapture]::FindPremier()
Write-Host "Found HWND: $hwnd"
if ($hwnd -ne [IntPtr]::Zero) {
    [WinCapture]::ShowWindow($hwnd, 3) # Maximize
    [WinCapture]::SetForegroundWindow($hwnd)
    Start-Sleep -Milliseconds 400

    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    Write-Host "Primary Screen Bounds: $($bounds.Width) x $($bounds.Height)"

    $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $g.Dispose()

    $outPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\live_screen_check.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved live screenshot to $outPath"
} else {
    Write-Host "Premier Pluss window not found"
}
