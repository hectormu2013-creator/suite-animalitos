Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
if (![System.IO.File]::Exists($imgFile)) {
    Write-Output "No existe $imgFile"
    exit 1
}

$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)
Write-Output "Dimensiones de la imagen: $($bmp.Width) x $($bmp.Height)"

# Vamos a encontrar posiciones de:
# 1. Lista de loterías a la izquierda (X aprox 10 a 240)
# 2. Checkboxes de Sorteos (Y aprox 70 a 115, X aprox 250 a 600)
# 3. Grid de Animalitos (X aprox 250 a 580, Y aprox 120 a 800)
# 4. Input NUM (F5) (X aprox 590 a 640, Y aprox 80)
# 5. Input MONTO (F6) (X aprox 650 a 720, Y aprox 80)
# 6. Boton [+] e [Imprimir] (X aprox 820 a 900, Y aprox 80)
# 7. Tabla de Jugadas del ticket (X aprox 590 a 900, Y aprox 120 a 800)
# 8. Boton Nuevo / Cancelar si existe (ver atajos o botones)

Write-Output "Analisis completado con exito."
$bmp.Dispose()
