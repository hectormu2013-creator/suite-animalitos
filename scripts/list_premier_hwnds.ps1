Add-Type -ReferencedAssemblies 'System.Drawing', 'System.Windows.Forms' @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WinFinder {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static void ListWindows() {
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == 24768) {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(hWnd, title, 256);
                RECT r;
                GetWindowRect(hWnd, out r);
                bool vis = IsWindowVisible(hWnd);
                Console.WriteLine("HWND: " + hWnd + " Title: '" + title.ToString() + "' Visible: " + vis + " Bounds: " + (r.Right - r.Left) + "x" + (r.Bottom - r.Top));
            }
            return true;
        }, IntPtr.Zero);
    }
}
"@

[WinFinder]::ListWindows()
