Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies 'System.Drawing', 'System.Windows.Forms' @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Drawing;

public class DpiCapture {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }
}
"@

# Activar DPI Aware para tener resolucion nativa 1:1 (1920x1080)
[DpiCapture]::SetProcessDPIAware() | Out-Null
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "Bounds nativos: $($bounds.Width) x $($bounds.Height)"

# En 1536x864, Guacharo Activo estaba en Y=347
# En 1920x1080 nativo, Y = 347 * (1080 / 864) = 347 * 1.25 = 434
# Pero ojo: el clic anterior fue a Y=347 sin DPI aware y cayo en Mega Animal 40 (Y=424 en 1536x864)
# Probemos el clic con DPI Aware activo a las coordenadas exactas escaladas o probemos la seleccion por teclado!
