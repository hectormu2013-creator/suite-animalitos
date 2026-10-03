param(
    [string]$Loteria = "LA GRANJITA"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class PremierKeyboardTest {
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

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

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
                    RECT r;
                    GetWindowRect(hWnd, out r);
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    bool vis = IsWindowVisible(hWnd);
                    bool min = IsIconic(hWnd);
                    if (min || (vis && w > 300 && h > 200)) {
                        found = hWnd;
                        return false;
                    }
                    if (found == IntPtr.Zero) {
                        found = hWnd;
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);

        if (found == IntPtr.Zero) {
            EnumWindows((hWnd, lParam) => {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(hWnd, title, 256);
                string t = title.ToString();
                if (t.Contains("Premier Pluss") || t.Contains("PremierPluss")) {
                    found = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
        }

        return found;
    }
}
"@

$hwnd = [PremierKeyboardTest]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "Premier no encontrado"
    exit 1
}

[PremierKeyboardTest]::ShowWindow($hwnd, 9)
[PremierKeyboardTest]::ShowWindow($hwnd, 3)
[PremierKeyboardTest]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 500

# Limpiar ticket
[System.Windows.Forms.SendKeys]::SendWait("n")
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 250

# Clic en LA GRANJITA (X=120, Y=173)
Write-Output "Seleccionando LA GRANJITA..."
[PremierKeyboardTest]::Click(120, 173)
Start-Sleep -Milliseconds 400

# Clic en sorteo 1 (X=328, Y=63)
Write-Output "Marcando proximo sorteo..."
[PremierKeyboardTest]::Click(328, 63)
Start-Sleep -Milliseconds 300

# Probar poner MONTO a 3000
Write-Output "Configurando Monto a 3000..."
[PremierKeyboardTest]::Click(865, 62)
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("3000")
Start-Sleep -Milliseconds 200

# Probar escribir numero en NUM (X=770, Y=62)
Write-Output "Probando clic en NUM (770, 62) y enviar numero '0' + ENTER..."
[PremierKeyboardTest]::Click(770, 62)
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("0")
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 500

# Tomar screenshot para ver qué pasó
$bmp = New-Object System.Drawing.Bitmap 1536, 864
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$cropRect = New-Object System.Drawing.Rectangle 700, 20, 750, 300
$crop = $bmp.Clone($cropRect, $bmp.PixelFormat)
$outPath = Join-Path $PSScriptRoot "..\crop_test_teclado.png"
$crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$bmp.Dispose()
$g.Dispose()

Write-Output "Screenshot guardado en crop_test_teclado.png"

# REGLA DE ORO DE SEGURIDAD: Limpiar siempre el ticket
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("n")
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Write-Output "Ticket limpiado por seguridad."
