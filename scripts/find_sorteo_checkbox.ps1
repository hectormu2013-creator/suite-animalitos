Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "--- Escaneando barra de sorteos en premier_guacharo_activo.png ---"
# El encabezado azul 'Sorteos: (GUACHARO ACTIVO)' esta en Y=45..75 aprox
# Las casillas de sorteo estan debajo del encabezado azul!
# Busquemos donde termina la barra azul y donde estan los checkboxes cuadrados (negro/blanco)
for ($y = 40; $y -lt 140; $y += 5) {
    for ($x = 220; $x -lt 650; $x += 20) {
        $c = $bmp.GetPixel($x, $y)
        # Si encontramos el borde negro de un checkbox (R < 30, G < 30, B < 30)
        # rodeado de gris claro o blanco
        if ($c.R -lt 30 -and $c.G -lt 30 -and $c.B -lt 30) {
            # Verificar si a la derecha hay blanco (interior de casilla)
            $cRight = $bmp.GetPixel($x + 4, $y + 4)
            if ($cRight.R -gt 230 -and $cRight.G -gt 230 -and $cRight.B -gt 230) {
                Write-Output "Posible casilla encontrada en Logico X=$x, Y=$y (Cursor 125%: X=$([math]::Round($x/1.25)), Y=$([math]::Round($y/1.25)))"
            }
        }
    }
}

$bmp.Dispose()
