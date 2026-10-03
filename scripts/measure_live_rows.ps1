Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile((Resolve-Path (Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png")).Path)

# En la imagen de 1536x864, el grid de animales está en X de 235 a 580
# Midpoints de columnas X: 275, 335, 395, 455, 515, 570 (aproximados)
# Veamos las filas de animales visibles desde Y=140 hasta Y=840

Write-Output "Dimensiones: $($b.Width) x $($b.Height)"

# Analicemos la posición de los números de fila en X=275 (columna 0)
# En X=275, bajamos en Y para detectar dónde están los centros de los círculos (fondo blanco / bordes)
for ($y = 140; $y -le 840; $y += 5) {
    $c = $b.GetPixel(275, $y)
    # Los círculos de animales tienen borde negro y fondo de color
    # Busquemos los centros aproximados de cada fila
}

# Medir las filas reales en la captura
# Fila Zebra (23): Y está alrededor de 280
# Fila Elefant (29): Y está alrededor de 370
# Fila Jirafa (35): Y está alrededor de 460
# Fila Canguro (41): Y está alrededor de 550
# Fila Pavo Re (47): Y está alrededor de 640
# Fila Caracol (53): Y está alrededor de 730
# Fila Pantera (59): Y está alrededor de 820

$b.Dispose()
