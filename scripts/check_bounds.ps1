Add-Type -ReferencedAssemblies 'System.Drawing', 'System.Windows.Forms' @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class DpiBounds {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    public static void Show() {
        SetProcessDPIAware();
        var bounds = Screen.PrimaryScreen.Bounds;
        Console.WriteLine(string.Format("Con DPI Aware -> Bounds: {0} x {1}", bounds.Width, bounds.Height));
    }
}
"@
[DpiBounds]::Show()
