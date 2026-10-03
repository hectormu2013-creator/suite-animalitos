Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Write-Output "========================================================"
Write-Output "   CALIBRADOR AUTOMATICO PREMIER PLUSS 2.0"
Write-Output "========================================================"

$procs = @(Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue)
if ($procs.Count -eq 0) {
    Write-Output "ERROR: Premier Pluss 2.0 no esta abierto."
    Write-Output "Por favor abre Premier Pluss en tu pantalla y vuelve a ejecutar este calibrador."
    exit 1
}

$pidList = ($procs | ForEach-Object { $_.Id }) -join ", "
Write-Output "Procesos detectados: PID(s) $pidList"

Add-Type -ReferencedAssemblies 'System.Drawing', 'System.Windows.Forms' @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class PremierInspector {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public class WinItem {
        public IntPtr Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
        public bool Visible;
        public bool Minimized;
        public int Left, Top, Width, Height;
    }

    public static List<WinItem> GetAllPremierWindows() {
        List<WinItem> list = new List<WinItem>();
        EnumWindows((hWnd, lParam) => {
            StringBuilder title = new StringBuilder(256);
            GetWindowText(hWnd, title, 256);
            string t = title.ToString();

            if (t.Contains("Premier Pluss") || t.Contains("PremierPluss")) {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                StringBuilder cls = new StringBuilder(256);
                GetClassName(hWnd, cls, 256);
                bool vis = IsWindowVisible(hWnd);
                bool min = IsIconic(hWnd);
                RECT r;
                GetWindowRect(hWnd, out r);

                list.Add(new WinItem {
                    Hwnd = hWnd,
                    Pid = pid,
                    Title = t,
                    ClassName = cls.ToString(),
                    Visible = vis,
                    Minimized = min,
                    Left = r.Left,
                    Top = r.Top,
                    Width = r.Right - r.Left,
                    Height = r.Bottom - r.Top
                });
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static bool RestoreAndFocus(IntPtr hWnd) {
        ShowWindow(hWnd, 9); // SW_RESTORE
        ShowWindow(hWnd, 3); // SW_MAXIMIZE
        return SetForegroundWindow(hWnd);
    }
}
"@

$windows = [PremierInspector]::GetAllPremierWindows()
Write-Output "Ventanas encontradas con titulo Premier Pluss: $($windows.Count)"

$targetHwnd = [IntPtr]::Zero

foreach ($w in $windows) {
    Write-Output "-> HWND: $($w.Hwnd) (PID $($w.Pid)) | Vis: $($w.Visible) | Min: $($w.Minimized) | Dim: $($w.Width)x$($w.Height) en ($($w.Left),$($w.Top)) | Titulo: '$($w.Title)'"
    if ($w.Title -match "Premier Pluss 2\.0") {
        $targetHwnd = $w.Hwnd
    }
}

if ($targetHwnd -eq [IntPtr]::Zero -and $windows.Count -gt 0) {
    $targetHwnd = $windows[0].Hwnd
}

if ($targetHwnd -ne [IntPtr]::Zero) {
    Write-Output "`n[ACCION] Restaurando y enfocando ventana principal (HWND: $targetHwnd)..."
    [PremierInspector]::RestoreAndFocus($targetHwnd) | Out-Null
    Start-Sleep -Milliseconds 1000

    # Medir ventana ya restaurada
    $rect = New-Object PremierInspector+RECT
    [PremierInspector]::GetWindowRect($targetHwnd, [ref]$rect) | Out-Null
    $w = $rect.Right - $rect.Left
    $h = $rect.Bottom - $rect.Top
    Write-Output "[EXITO] Ventana enfocada con tamano: $w x $h en ($($rect.Left), $($rect.Top))"

    # Capturar pantalla completa para calibracion
    try {
        $screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $fullBmp = New-Object System.Drawing.Bitmap $screenBounds.Width, $screenBounds.Height
        $fullG = [System.Drawing.Graphics]::FromImage($fullBmp)
        $fullG.CopyFromScreen($screenBounds.Location, [System.Drawing.Point]::Empty, $screenBounds.Size)
        $outPath = "$PSScriptRoot\..\premier_pantalla_calibrada.png"
        $fullBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $fullG.Dispose()
        $fullBmp.Dispose()
        Write-Output "[EXITO] Captura de pantalla guardada en: premier_pantalla_calibrada.png"
    } catch {
        Write-Output "Aviso en captura: $($_.Exception.Message)"
    }
} else {
    Write-Output "[AVISO] No se detecto ventana activa de Premier Pluss."
}
