try {
    Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class AllWinDetector2 {
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    public static List<string> ListAll() {
        var list = new List<string>();
        try {
            EnumWindows((hWnd, lParam) => {
                try {
                    uint pid = 0;
                    GetWindowThreadProcessId(hWnd, out pid);
                    StringBuilder t = new StringBuilder(256);
                    GetWindowText(hWnd, t, 256);
                    string title = t.ToString().Trim();
                    bool vis = IsWindowVisible(hWnd);
                    bool min = IsIconic(hWnd);
                    if (vis || min) {
                        list.Add("HWND=" + hWnd + " PID=" + pid + " Vis=" + vis + " Min=" + min + " Title='" + title + "'");
                    }
                } catch (Exception ex) {
                    list.Add("INNER_ERR: " + ex.Message);
                }
                return true;
            }, IntPtr.Zero);
        } catch (Exception ex2) {
            list.Add("OUTER_ERR: " + ex2.Message);
        }
        return list;
    }
}
"@
    $results = [AllWinDetector2]::ListAll()
    $results | Out-File (Join-Path $PSScriptRoot "debug_windows.txt") -Encoding utf8
    Write-Output "WROTE $($results.Count) WINDOWS"
} catch {
    $_ | Out-File (Join-Path $PSScriptRoot "debug_windows.txt") -Encoding utf8
    Write-Output "EXCEPTION: $_"
}
