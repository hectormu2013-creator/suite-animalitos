Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class CaptureF2 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@

$procs = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue
if ($procs) {
    $hwnd = $procs[0].MainWindowHandle
    if ($hwnd -ne [IntPtr]::Zero) {
        [CaptureF2]::ShowWindow($hwnd, 9)
        [CaptureF2]::ShowWindow($hwnd, 3)
        [CaptureF2]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 400
        
        # Enviar F2 para asegurar que este en Animalitos
        [System.Windows.Forms.SendKeys]::SendWait("{F2}")
        Start-Sleep -Milliseconds 500
        
        # Capturar el sidebar izquierdo
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap 320, 600
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen((New-Object System.Drawing.Point 0, 0), [System.Drawing.Point]::Empty, (New-Object System.Drawing.Size 320, 600))
        $g.Dispose()
        
        $outPath = "C:\Users\Hector\.gemini\antigravity-ide\brain\b48ae5e9-a301-4bed-aff7-cf74cd37a546\sidebar_f2_animalitos.png"
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Output "Captured sidebar to $outPath"
    } else {
        Write-Output "MainWindowHandle is Zero"
    }
} else {
    Write-Output "PremierPlussPC20 not running"
}
