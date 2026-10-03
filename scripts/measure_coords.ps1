Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

# Medir las filas de la lista de loterías
# X = 120 (centro de la lista de loterias)
# Y va de 145 a 490
Write-Output "--- Escaneo de colores en columna de loterías (X=120) ---"
$prevColor = ""
for ($y = 145; $y -le 490; $y += 2) {
    $c = $bmp.GetPixel(120, $y)
    $hex = "{0:X2}{1:X2}{2:X2}" -f $c.R, $c.G, $c.B
    # Detectar transiciones de color
    # Azul encabezado / seleccionado: 0078D7 o similar
    # Blanco / Gris alternado
}

# Medir botones superiores derechos
# Imprimir, [+] y [Bs]
# En crop_buttons (X desde 1100 a 1530, Y desde 50 a 110)
for ($x = 1100; $x -le 1450; $x += 5) {
    $c = $bmp.GetPixel($x, 80)
    # Si es azul brillante
    if ($c.B -gt 200 -and $c.R -lt 100) {
        Write-Output "Boton azul encontrado en X=$x, Y=80 (R:$($c.R), G:$($c.G), B:$($c.B))"
    }
}

$bmp.Dispose()
