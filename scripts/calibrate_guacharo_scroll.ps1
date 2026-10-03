Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class PremierScrollTest {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
    public const uint MOUSEEVENTF_WHEEL    = 0x0800;

    public static IntPtr FindPremier() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                    StringBuilder title = new StringBuilder(256);
                    GetWindowText(hWnd, title, 256);
                    string t = title.ToString();
                    if (t.Contains("Premier Pluss")) {
                        found = hWnd;
                        return false;
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void ScrollWheel(int x, int y, int ticks, int delta) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(50);
        for (int i = 0; i < ticks; i++) {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, UIntPtr.Zero);
            System.Threading.Thread.Sleep(10);
        }
    }
}
"@

$hwnd = [PremierScrollTest]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "ERROR: Premier Pluss no detectado"
    exit 1
}

Write-Output "Enfocando Premier Pluss..."
[PremierScrollTest]::ShowWindow($hwnd, 9)
[PremierScrollTest]::ShowWindow($hwnd, 3)
[PremierScrollTest]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 400

# Seleccionar Guacharo Activo
[PremierScrollTest]::Click(120, 270)
Start-Sleep -Milliseconds 300

# Subir al tope absoluto
Write-Output "Subiendo al tope absoluto..."
[PremierScrollTest]::ScrollWheel(500, 400, 80, 120)
Start-Sleep -Milliseconds 500

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

# Bajar con 80 wheel ticks
Write-Output "Bajando con 80 wheel ticks..."
[PremierScrollTest]::ScrollWheel(500, 400, 80, -120)
Start-Sleep -Milliseconds 600

# Capturar vista inferior
$bmpBottom = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmpBottom)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$outFile = Join-Path $PSScriptRoot "..\test_scrolled_80ticks.png"
$bmpBottom.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmpBottom.Dispose()

Write-Output "Captura guardada en test_scrolled_80ticks.png"
