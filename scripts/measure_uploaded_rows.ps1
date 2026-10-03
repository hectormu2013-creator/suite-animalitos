Add-Type -AssemblyName System.Drawing

$imgFile = "C:\Users\Hector\.gemini\antigravity-ide\brain\74a0f376-06d9-4223-bb37-11a143fd80c0\.user_uploaded\media_1790895594467.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "Uploaded image size: $($bmp.Width) x $($bmp.Height)"

# Medir las filas exactas en la columna 0 (X ≈ 440 logico -> X=270 aprox en la imagen)
# Vamos a escanear verticalmente para encontrar los centros de los circulos de cada fila
# De arriba a abajo:
# Fila A: 23 Zebra (rojo)
# Fila B: 29 Elefante
# Fila C: 35 Jirafa
# Fila D: 41 Canguro
# Fila E: 47 Pavo Real
# Fila F: 53 Caracol
# Fila G: 59 Pantera
# Fila H: 65 Araña
# Fila I: 71 Guacamaya (rojo)

# Encontremos la posicion X de la primera columna
for ($x = 220; $x -lt 350; $x += 5) {
    # Guacamaya 71 en el fondo es roja brillante
    $c = $bmp.GetPixel($x, 880)
    if ($c.R -gt 180 -and $c.G -lt 50) {
        Write-Output "Columna 0 encontrada cerca de X=$x"
        $col0X = $x
        break
    }
}

$bmp.Dispose()
