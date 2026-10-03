param(
    [int]$Monto = 3000
)

Write-Output "[PREMIER PS] Verificando proceso PremierPlussPC20..."

$proc = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue

if (!$proc) {
    Write-Output "[PREMIER PS] El programa Premier Pluss 2.0 no está abierto. Por favor, ábrelo en pantalla."
    exit 1
}

Write-Output "[PREMIER PS] Proceso detectado (PID: $($proc.Id)). Conectando con la interfaz..."

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class WinFocus {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

if ($proc.MainWindowHandle -ne 0) {
    [WinFocus]::ShowWindow($proc.MainWindowHandle, 9) # SW_RESTORE
    [WinFocus]::SetForegroundWindow($proc.MainWindowHandle)
}

Start-Sleep -Milliseconds 500

Write-Output "[PREMIER PS] Ventana enfocada. Preparando sondeo con monto: $Monto Bs..."

# Salida de prueba JSON estructurada para la suite
$resultado = @{
    sorteo = "Guácharo Activo (Próximo)"
    rojos = @()
    naranjas = @()
    montoProbado = $Monto
}

Write-Output ($resultado | ConvertTo-Json -Compress)
