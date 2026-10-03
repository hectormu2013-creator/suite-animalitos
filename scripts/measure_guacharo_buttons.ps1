Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "--- Escaneando botones superiores en premier_guacharo_activo.png ---"
for ($x = 600; $x -lt 1500; $x += 10) {
    $c = $bmp.GetPixel($x, 75)
    # Azul de los botones Imprimir, + y Bs (R:0, G:158, B:247)
    if ($c.B -gt 200 -and $c.R -lt 50) {
        Write-Output "Boton azul detectado en Logico X=$x, Y=75 (Cursor 125%: X=$([math]::Round($x/1.25)), Y=$([math]::Round(75/1.25)))"
    }
}

$bmp.Dispose()
